'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DynamicMapPinPicker } from '@/components/map/DynamicMap';
import {
  Shield,
  BarChart3,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Sparkles,
  MapPin,
  Clock,
  ArrowLeft,
  Smartphone,
  Laptop,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalPlaces: number;
    approvedReviews: number;
    pendingReviews: number;
    pendingSuggestions: number;
    totalUniqueVisitsLogged: number;
  };
  visitorsTimeline: Array<{ date: string; visitors: number; mobile: number; desktop: number }>;
  topSearches: Array<{ query: string; count: number; search_type: string }>;
  zeroResults: Array<{ query: string; search_type: string; created_at: string }>;
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Data states
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New Place Form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState(28.6139);
  const [newLng, setNewLng] = useState(77.2090);
  const [newGoogleMapsUrl, setNewGoogleMapsUrl] = useState('');
  const [newPriceLevel, setNewPriceLevel] = useState<'budget' | 'moderate' | 'expensive'>('budget');
  const [newCost, setNewCost] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [addPlaceStatus, setAddPlaceStatus] = useState<string | null>(null);
  const [isResolvingAdminUrl, setIsResolvingAdminUrl] = useState(false);
  const [isCronRunning, setIsCronRunning] = useState(false);
  const [cronResultStatus, setCronResultStatus] = useState<string | null>(null);

  const handleTriggerAiCategorizer = async () => {
    setIsCronRunning(true);
    setCronResultStatus(null);
    try {
      const res = await fetch('/api/cron/weekly-summary', {
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run AI categorizer');

      setCronResultStatus(`Successfully analyzed & categorized ${data.summarizedCount} spots! Cleaned up typos and aligned category filters.`);
      setTimeout(() => setCronResultStatus(null), 8000);
    } catch (err: unknown) {
      setCronResultStatus((err as Error).message || 'Failed to run AI categorizer');
    } finally {
      setIsCronRunning(false);
    }
  };

  const handleResolveAdminMapsUrl = async (url: string) => {
    if (!url.trim()) return;
    setIsResolvingAdminUrl(true);
    try {
      const res = await fetch('/api/resolve-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.latitude && data.longitude) {
        setNewLat(data.latitude);
        setNewLng(data.longitude);
        setAddPlaceStatus(`Pin coordinates auto-detected from Maps (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})`);
        setTimeout(() => setAddPlaceStatus(null), 4000);
      }
    } catch (err: unknown) {
      console.warn('Could not auto-resolve maps URL:', err);
    } finally {
      setIsResolvingAdminUrl(false);
    }
  };

  // Authenticate Admin
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsLoading(true);
    setAuthError('');

    fetch('/api/admin/analytics', {
      headers: { 'x-admin-token': tokenInput.trim() },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Invalid token');
        }
        const data = await res.json();
        setAnalytics(data);
        setAdminToken(tokenInput.trim());
        setIsAuthenticated(true);
        try {
          localStorage.setItem('pinchaat_admin_token', tokenInput.trim());
        } catch (_) {}
        loadModerationQueues(tokenInput.trim());
      })
      .catch(() => {
        setAuthError('Invalid Admin Passphrase. Check ADMIN_ACCESS_TOKEN in .env.local');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const loadModerationQueues = (token: string) => {
    // Fetch pending reviews
    fetch('/api/admin/reviews', { headers: { 'x-admin-token': token } })
      .then((res) => res.json())
      .then((data) => {
        if (data.reviews) {
          setPendingReviews(data.reviews.filter((r: any) => r.status === 'pending'));
        }
      })
      .catch(() => {});

    // Fetch pending suggestions
    fetch('/api/admin/suggestions', { headers: { 'x-admin-token': token } })
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions) {
          setPendingSuggestions(data.suggestions.filter((s: any) => s.status === 'pending'));
        }
      })
      .catch(() => {});
  };

  // Moderate Review (Approve generates Gemini 768-dim vector embedding)
  const handleModerateReview = async (reviewId: string, action: 'approve' | 'reject') => {
    setActionLoadingId(reviewId);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ review_id: reviewId, action }),
      });

      if (res.ok) {
        setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId));
      }
    } catch (err: unknown) {
      console.error('Moderation error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Moderate Place Suggestion
  const handleModerateSuggestion = async (suggestionId: string, action: 'approve' | 'reject') => {
    setActionLoadingId(suggestionId);
    try {
      const res = await fetch('/api/admin/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ suggestion_id: suggestionId, action }),
      });

      if (res.ok) {
        setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      }
    } catch (err: unknown) {
      console.error('Suggestion moderation error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create Place Directly
  const handleCreatePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsLoading(true);
    setAddPlaceStatus(null);

    try {
      const res = await fetch('/api/admin/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          name: newName.trim(),
          address: newAddress.trim(),
          latitude: newLat,
          longitude: newLng,
          google_maps_url: newGoogleMapsUrl.trim() || null,
          price_level: newPriceLevel,
          average_cost_per_person: newCost ? parseFloat(newCost) : null,
          tags: newTags,
          description: newDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add place');

      setAddPlaceStatus('Spot successfully pinned to map!');
      setNewName('');
      setNewAddress('');
      setNewTags('');
      setNewCost('');
      setNewDescription('');
    } catch (err: unknown) {
      setAddPlaceStatus((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Login Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto size-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center text-orange-600 mb-2">
              <Shield className="size-6" />
            </div>
            <CardTitle className="text-xl">PinChaat Admin Portal</CardTitle>
            <CardDescription className="text-xs">
              Enter your admin passphrase to access analytics and review moderation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <Input
                type="password"
                placeholder="Enter ADMIN_ACCESS_TOKEN..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="text-sm"
              />

              {authError && <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>}

              <div className="flex gap-2">
                <Link
                  href="/"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'flex-1 text-xs' })}
                >
                  <ArrowLeft data-icon="inline-start" /> Back to App
                </Link>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !tokenInput.trim()}
                  className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isLoading ? 'Verifying...' : 'Unlock Portal'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Admin Topbar */}
      <header className="border-b border-border bg-card/60 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-orange-600" />
            <h1 className="font-bold text-base">PinChaat Admin & Analytics</h1>
          </div>
          <Link
            href="/"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-xs text-muted-foreground gap-1' })}
          >
            <ArrowLeft data-icon="inline-start" /> Return to Map
          </Link>
        </div>
      </header>

      {/* Admin Tabs */}
      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        <Tabs defaultValue="analytics" className="w-full flex flex-col gap-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl bg-muted/60 p-1">
            <TabsTrigger value="analytics" className="text-xs gap-1.5">
              <BarChart3 className="size-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs gap-1.5">
              <CheckCircle2 className="size-3.5" /> Reviews ({pendingReviews.length})
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="text-xs gap-1.5">
              <Clock className="size-3.5" /> Suggestions ({pendingSuggestions.length})
            </TabsTrigger>
            <TabsTrigger value="add-place" className="text-xs gap-1.5">
              <PlusCircle className="size-3.5" /> Add Spot
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ANALYTICS */}
          <TabsContent value="analytics" className="flex flex-col gap-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs">Unique Visitors</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-foreground">
                    {analytics?.summary.totalUniqueVisitsLogged || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
                  Salted-hash rotated daily (GDPR-friendly)
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs">Total Spots</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-foreground">
                    {analytics?.summary.totalPlaces || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
                  Active curated foodie pins
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs">Approved Reviews</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-green-600">
                    {analytics?.summary.approvedReviews || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
                  Vector embedded with Gemini (768-dim)
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs">Pending Moderation</CardDescription>
                  <CardTitle className="text-2xl font-extrabold text-amber-600">
                    {(analytics?.summary.pendingReviews || 0) + (analytics?.summary.pendingSuggestions || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
                  Awaiting your approval
                </CardContent>
              </Card>
            </div>

            {/* AI Taxonomy & Spelling Categorizer Card */}
            <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/15">
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-foreground mb-1">
                    <Sparkles className="size-4 text-orange-600" />
                    AI Auto-Categorizer & Taxonomy Alignment
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Automatically scans all spots, fixes typos in food tags (e.g. <em>"wadapav" → "vada pav"</em>), maps spots into standard categories (<em>street food, thali, chaat</em>), and updates rolling summaries.
                  </p>
                  {cronResultStatus && (
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 mt-2">
                      {cronResultStatus}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={handleTriggerAiCategorizer}
                  disabled={isCronRunning}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5 shrink-0"
                >
                  {isCronRunning ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Analyzing & Normalizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Run AI Categorizer Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Cravings Intelligence & Zero Result Alert */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Searches */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <Sparkles className="size-4 text-amber-500" /> Top Searched Cravings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    What foodies are actively searching for on PinChaat.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.topSearches && analytics.topSearches.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {analytics.topSearches.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                          <span className="font-medium text-foreground">"{item.query}"</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {item.search_type}
                            </Badge>
                            <span className="font-mono text-muted-foreground">{item.count} searches</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No search queries logged yet.</p>
                  )}
                </CardContent>
              </Card>

              {/* Zero-Result Queries (Unmet Food Demands) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-orange-600">
                    <AlertTriangle className="size-4" /> Unmet Cravings (0 Results)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dishes & locations people searched for that returned 0 spots. Visit and add these next!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.zeroResults && analytics.zeroResults.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {analytics.zeroResults.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                          <span className="font-semibold text-foreground">"{item.query}"</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">All recent searches found matching spots!</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: REVIEWS MODERATION QUEUE */}
          <TabsContent value="reviews" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Pending Reviews Queue</h2>
                <p className="text-xs text-muted-foreground">
                  Approving a review automatically triggers Gemini 768-dimension vector embedding.
                </p>
              </div>
            </div>

            {pendingReviews.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                All submitted reviews have been moderated. Good job!
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingReviews.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-foreground">{r.places?.name || 'Spot'}</span>
                          <Badge variant="outline" className="text-[11px]">
                            {r.rating} ★
                          </Badge>
                          <span className="text-xs text-muted-foreground">by {r.author_name}</span>
                        </div>
                        <p className="text-xs text-foreground/90 leading-relaxed mb-2">"{r.content}"</p>
                        {r.must_try_dishes && r.must_try_dishes.length > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">Must-try: </span>
                            {r.must_try_dishes.join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === r.id}
                          onClick={() => handleModerateReview(r.id, 'reject')}
                          className="text-xs text-red-600 hover:bg-red-50"
                        >
                          <XCircle data-icon="inline-start" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={actionLoadingId === r.id}
                          onClick={() => handleModerateReview(r.id, 'approve')}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                          {actionLoadingId === r.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CheckCircle2 data-icon="inline-start" />
                          )}
                          Approve & Embed
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: PLACE SUGGESTIONS QUEUE */}
          <TabsContent value="suggestions" className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold">Community Place Suggestions</h2>
              <p className="text-xs text-muted-foreground">
                Review unlisted gems suggested by anonymous patrons.
              </p>
            </div>

            {pendingSuggestions.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                No pending suggestions in the queue.
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingSuggestions.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-foreground">{s.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {s.price_level}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <MapPin className="size-3 shrink-0" /> {s.address || `${s.latitude}, ${s.longitude}`}
                        </p>
                        {s.reason && <p className="text-xs text-foreground/80 italic mb-2">"{s.reason}"</p>}
                        {s.tags && s.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {s.tags.map((t: string) => (
                              <Badge key={t} variant="outline" className="text-[10px]">
                                #{t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === s.id}
                          onClick={() => handleModerateSuggestion(s.id, 'reject')}
                          className="text-xs text-red-600 hover:bg-red-50"
                        >
                          <XCircle data-icon="inline-start" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={actionLoadingId === s.id}
                          onClick={() => handleModerateSuggestion(s.id, 'approve')}
                          className="text-xs bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <CheckCircle2 data-icon="inline-start" /> Approve & Pin to Map
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: ADD SPOT DIRECTLY */}
          <TabsContent value="add-place">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base">Pin a New Foodie Spot</CardTitle>
                <CardDescription className="text-xs">
                  Click anywhere on the map or drag the pin to set the exact stall coordinates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePlace} className="flex flex-col gap-4">
                  {/* Pin Picker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold">Location Coordinates</label>
                    <DynamicMapPinPicker
                      initialLat={newLat}
                      initialLng={newLng}
                      onPickCoordinates={(lat, lng, suggestedAddress) => {
                        setNewLat(lat);
                        setNewLng(lng);
                        if (suggestedAddress && !newAddress) {
                          setNewAddress(suggestedAddress);
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Place / Stall Name *</label>
                      <Input
                        required
                        placeholder="e.g. Shyam Sweets"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Address / Landmark</label>
                      <Input
                        placeholder="e.g. Chawri Bazar, Old Delhi"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Approx. Cost / Person (₹)</label>
                      <Input
                        type="number"
                        placeholder="e.g. 120"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Tags (comma separated)</label>
                      <Input
                        placeholder="street food, bedmi puri, breakfast"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold">Google Maps URL (optional)</label>
                      {newGoogleMapsUrl && (
                        <button
                          type="button"
                          onClick={() => handleResolveAdminMapsUrl(newGoogleMapsUrl)}
                          disabled={isResolvingAdminUrl}
                          className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-medium"
                        >
                          {isResolvingAdminUrl ? 'Detecting coordinates...' : '⚡ Extract Pin from Link'}
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Paste Google Maps URL to auto-extract coordinates..."
                      value={newGoogleMapsUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewGoogleMapsUrl(val);
                        if (val.includes('maps.google.') || val.includes('goo.gl') || val.includes('google.com/maps')) {
                          handleResolveAdminMapsUrl(val);
                        }
                      }}
                      onBlur={() => {
                        if (newGoogleMapsUrl.trim()) handleResolveAdminMapsUrl(newGoogleMapsUrl);
                      }}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold">Description / Notes</label>
                    <Textarea
                      rows={2}
                      placeholder="Famous morning nagori halwa and bedmi puri..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  {addPlaceStatus && (
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                      {addPlaceStatus}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || !newName.trim()}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                  >
                    {isLoading ? 'Saving...' : 'Pin Spot to Map'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
