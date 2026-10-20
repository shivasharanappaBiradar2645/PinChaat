-- ================================================================
-- PINCHAAT DATABASE SCHEMA (Dedicated 'pinchaat' Schema)
-- ================================================================

-- 1. Enable pgvector in public or extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Dedicated pinchaat schema
CREATE SCHEMA IF NOT EXISTS pinchaat;

-- Grant schema usage
GRANT USAGE ON SCHEMA pinchaat TO anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 3. Places Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinchaat.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  summary TEXT,                             -- Rolling AI-generated summary
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  google_maps_url TEXT,                     -- External link for direct navigation
  price_level TEXT CHECK (price_level IN ('budget', 'moderate', 'expensive')) DEFAULT 'moderate',
  average_cost_per_person NUMERIC(10, 2),
  tags TEXT[] DEFAULT '{}',                 -- e.g. ARRAY['street food', 'dosa', 'chai']
  cover_image_url TEXT,
  view_count INT DEFAULT 0,
  latest_profile_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 4. Place Suggestions Table (Community suggestions with status)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinchaat.place_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  google_maps_url TEXT,
  price_level TEXT CHECK (price_level IN ('budget', 'moderate', 'expensive')) DEFAULT 'moderate',
  tags TEXT[] DEFAULT '{}',
  reason TEXT,                              -- Why this place should be pinned
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 5. Reviews Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinchaat.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES pinchaat.places(id) ON DELETE CASCADE,
  author_name TEXT DEFAULT 'Anonymous Foodie',
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  content TEXT NOT NULL,
  must_try_dishes TEXT[] DEFAULT '{}',
  price_paid NUMERIC(10, 2),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  embedding VECTOR(768),                    -- 768-dim from gemini-embedding-2 (MRL)
  embedding_model TEXT DEFAULT 'gemini-embedding-2',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- Index for vector cosine similarity search
CREATE INDEX IF NOT EXISTS reviews_embedding_idx ON pinchaat.reviews 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ----------------------------------------------------------------
-- 6. Place Profiles Table (Versioned AI Summaries)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinchaat.place_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES pinchaat.places(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  summary TEXT NOT NULL,
  must_try_dishes TEXT[] DEFAULT '{}',
  price_range_min NUMERIC(10, 2),
  price_range_max NUMERIC(10, 2),
  vibe_tags TEXT[] DEFAULT '{}',
  review_count_sampled INT NOT NULL DEFAULT 0,
  model_used TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  embedding VECTOR(768),
  embedding_model TEXT DEFAULT 'gemini-embedding-2',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 7. Rate Limits Table & Atomic Procedure (Postgres-Backed)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinchaat.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION pinchaat.check_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pinchaat, pg_temp
AS $$
DECLARE
  v_count INT;
  v_reset TIMESTAMPTZ;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT count, reset_at INTO v_count, v_reset
  FROM pinchaat.rate_limits
  WHERE key = p_key FOR UPDATE;

  IF NOT FOUND OR v_now > v_reset THEN
    INSERT INTO pinchaat.rate_limits (key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE
    SET count = 1, reset_at = v_now + (p_window_seconds || ' seconds')::INTERVAL;
    RETURN TRUE;
  ELSIF v_count < p_limit THEN
    UPDATE pinchaat.rate_limits
    SET count = count + 1
    WHERE key = p_key;
    RETURN TRUE;
  ELSE
    RETURN FALSE; -- Limit exceeded
  END IF;
END;
$$;

-- Revoke execute from public/anon, grant only to service_role
REVOKE EXECUTE ON FUNCTION pinchaat.check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pinchaat.check_rate_limit(TEXT, INT, INT) TO service_role;

-- ----------------------------------------------------------------
-- 8. Analytics Tables (Privacy-First Salted Visitor Hash)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinchaat.analytics_daily_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visitor_hash TEXT NOT NULL,               -- SHA256(IP + SERVER_SALT + YYYY-MM-DD)
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  path TEXT NOT NULL,
  place_id UUID REFERENCES pinchaat.places(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_visitor_per_date_path UNIQUE (visit_date, visitor_hash, path)
);

CREATE TABLE IF NOT EXISTS pinchaat.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  search_type TEXT CHECK (search_type IN ('keyword', 'semantic', 'location')),
  results_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Retention policy cleanup function (e.g. prune after 90 days)
CREATE OR REPLACE FUNCTION pinchaat.cleanup_old_search_logs(retention_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pinchaat, pg_temp
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM pinchaat.search_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION pinchaat.cleanup_old_search_logs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pinchaat.cleanup_old_search_logs(INT) TO service_role;

-- ----------------------------------------------------------------
-- 9. Hardened Vector Match Function (SECURITY DEFINER)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION pinchaat.match_reviews(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  review_id UUID,
  place_id UUID,
  content TEXT,
  must_try_dishes TEXT[],
  rating INT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pinchaat, public, extensions, pg_temp
AS $$
DECLARE
  v_limit INT;
BEGIN
  -- Strict cap to prevent resource exhaustion
  v_limit := LEAST(COALESCE(match_count, 10), 50);

  RETURN QUERY
  SELECT
    r.id,
    r.place_id,
    r.content,
    r.must_try_dishes,
    r.rating,
    (1 - (r.embedding <=> query_embedding))::FLOAT AS similarity
  FROM pinchaat.reviews r
  WHERE r.status = 'approved'
    AND r.embedding IS NOT NULL
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION pinchaat.match_reviews(VECTOR(768), FLOAT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pinchaat.match_reviews(VECTOR(768), FLOAT, INT) TO service_role;

-- ----------------------------------------------------------------
-- 10. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------
ALTER TABLE pinchaat.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinchaat.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinchaat.place_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinchaat.place_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinchaat.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinchaat.analytics_daily_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinchaat.search_logs ENABLE ROW LEVEL SECURITY;

-- Places: Anon can SELECT public rows
CREATE POLICY "Public places select" ON pinchaat.places
  FOR SELECT TO anon, authenticated USING (true);

-- Reviews: Anon can only SELECT approved reviews
CREATE POLICY "Public approved reviews select" ON pinchaat.reviews
  FOR SELECT TO anon, authenticated USING (status = 'approved');

-- Place Profiles: Anon can SELECT
CREATE POLICY "Public place profiles select" ON pinchaat.place_profiles
  FOR SELECT TO anon, authenticated USING (true);

-- Place Suggestions: Anon can only SELECT approved suggestions
CREATE POLICY "Public approved suggestions select" ON pinchaat.place_suggestions
  FOR SELECT TO anon, authenticated USING (status = 'approved');

-- No direct SELECT/INSERT policies for anon on:
-- rate_limits, analytics_daily_visitors, search_logs.
-- (All writes and analytics queries happen through Server Route Handlers using service_role)
