# 📌 PinChaat — Community Foodie Discovery & Semantic Cravings Guide

PinChaat is a community-driven, curated foodie review and discovery platform powered by **semantic search**, **OpenStreetMap**, and **Google Gemini AI**, engineered strictly for the 100% free tier.

---

## 🌟 Key Features

- **Free OpenStreetMap & Interactive Pin-Dropper**:
  - Interactive Leaflet map with official open-source OpenStreetMap tiles (zero fees, no commercial restrictions).
  - Custom pin-dropping for unlisted street stalls with free Nominatim address geocoding.
  - Automatic Google Maps link coordinate extractor (`/@lat,lng`, `!3d!4d`, and `?q=lat,lng` formats).
  - Browser-based "Near Me" GPS proximity sorting.

- **AI Cravings Semantic Search**:
  - Natural language cravings search (e.g. *"crispy butter masala dosa with spicy podi"*, *"midnight comfort rolls"*).
  - Powered by Google Gemini `gemini-embedding-2` (768-dim, Matryoshka Representation Learning) + Supabase `pgvector` cosine similarity.
  - Multi-tier Postgres-backed atomic rate limiting (8 req/min for semantic search) with automatic fallback to keyword search.

- **Community Reviews & Moderation Pipeline**:
  - Anonymous patrons can submit reviews with must-try dishes and price paid per person.
  - Review moderation queue: Approving a review automatically vectorizes it via Gemini into `pinchaat.reviews`.
  - **Unlimited Admin Reviews**: Admins can write and publish unlimited reviews that are instantly approved and vector-embedded with zero cooldown limits.

- **Dedicated `pinchaat` Database Schema & Security**:
  - All tables reside in a dedicated `pinchaat.*` schema.
  - Row-Level Security (RLS) enabled on all tables: public/anon is restricted to `SELECT` on approved records only.
  - Hardened `pinchaat.match_reviews` vector search function (`SECURITY DEFINER` with search path fixed and execute revoked from anon).

- **Versioned Place Profiles & Weekly AI Cron**:
  - Automated weekly cron endpoint (`/api/cron/weekly-summary`) configured via `vercel.json`.
  - Synthesizes community reviews using `gemini-2.0-flash` with structured JSON output and prompt injection isolation.

- **Privacy-Preserving Visitor Analytics**:
  - Daily rotated salted hash `SHA256(IP + SALT + YYYY-MM-DD)` for unique visitor counts without tracking users across days.
  - Tracks top searched cravings and detects **Zero-Result Queries** (unmet food cravings to explore and pin next).

- **Mobile-First Experience**:
  - Responsive toggle between List View and Map View.
  - Native-feeling Shadcn Drawer (bottom sheet) for mobile spot details and patron reviews.

---

## 🛠️ Tech Stack (100% Free Tier)

| Service | Technology | Purpose |
|---|---|---|
| **Frontend & API** | Next.js 15 (App Router, Tailwind CSS, Shadcn UI) | Full-stack application hosted on Vercel |
| **Maps** | Leaflet + OpenStreetMap | 100% open-source interactive map & pin picker |
| **Database & Vectors** | Supabase (PostgreSQL + `pgvector`) | Relational database, RLS, vector cosine similarity |
| **AI / Embeddings** | Google Gemini (`gemini-embedding-2` & `gemini-2.0-flash`) | 768-dim embeddings & structured summaries |
| **Scheduled Jobs** | Vercel Cron (`vercel.json`) | Weekly automated review summarizer |

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)

1. Open your **[Supabase Dashboard](https://supabase.com)** and create a new project.
2. Go to the **SQL Editor** (`>_`).
3. Copy and run the entire contents of [`supabase/schema.sql`](./supabase/schema.sql).
4. Run the schema grants to enable API access for custom schemas:
   ```sql
   GRANT ALL ON ALL TABLES IN SCHEMA pinchaat TO postgres, service_role;
   GRANT SELECT ON ALL TABLES IN SCHEMA pinchaat TO anon, authenticated;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA pinchaat TO postgres, service_role;
   GRANT ALL ON ALL ROUTINES IN SCHEMA pinchaat TO postgres, service_role;
   ```
5. In **Project Settings → API → Data API Settings → Exposed schemas**, add **`pinchaat`** to the list and save.

### 2. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Fill in your configuration:

```ini
# Supabase Public Keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase Server-Only Secret (Never prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Gemini API Key (from Google AI Studio)
GEMINI_API_KEY=your-gemini-api-key

# Admin Secret Passphrase (used to unlock /admin)
ADMIN_ACCESS_TOKEN=your-custom-admin-password

# Vercel Cron Secret (protects /api/cron/weekly-summary)
CRON_SECRET=your-random-cron-secret-token

# Analytics Salt for Daily Hash Rotation
SERVER_ANALYTICS_SALT=any-random-salt-string
```

### 3. Run the Development Server

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
Visit [http://localhost:3000/admin](http://localhost:3000/admin) to unlock the admin portal.

### 4. Deploying to Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Under **Project Settings → Environment Variables**, add the environment variables from your `.env.local`.
4. Deploy! Vercel will automatically read `vercel.json` to enable the weekly AI summary cron job at zero cost.

