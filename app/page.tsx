'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { DynamicFoodieMap } from '@/components/map/DynamicMap';
import SearchBar from '@/components/search/SearchBar';
import PlaceCard, { PlaceItem } from '@/components/places/PlaceCard';
import ReviewModal from '@/components/places/ReviewModal';
import SuggestPlaceModal from '@/components/places/SuggestPlaceModal';
import {
  UtensilsCrossed,
  Map as MapIcon,
  List as ListIcon,
  PlusCircle,
  Shield,
  Navigation,
  Sparkles,
  ExternalLink,
  MessageSquarePlus,
  Compass,
} from 'lucide-react';

export default function HomePage() {
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<PlaceItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Modals & Mobile View States
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Search states
  const [isSearching, startSearchTransition] = useTransition();
  const [isLocating, setIsLocating] = useState(false);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>('all');

  // Track page view for daily unique visitor analytics
  useEffect(() => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' }),
    }).catch(() => {});
  }, []);

  // Fetch places on load
  useEffect(() => {
    fetch('/api/admin/places')
      .then((res) => res.json())
      .then((data) => {
        if (data.places && data.places.length > 0) {
          setPlaces(data.places);
          setFilteredPlaces(data.places);
        }
      })
      .catch(() => {
        // Fallback places remain active
      });
  }, []);

  // Filter by tag
  const handleTagFilter = (tag: string) => {
    setActiveTag(tag);
    if (tag === 'all') {
      setFilteredPlaces(places);
    } else {
      setFilteredPlaces(
        places.filter((p) => p.tags?.some((t) => t.toLowerCase().includes(tag.toLowerCase())))
      );
    }
  };

  // Search Handler (Semantic Cravings or Keyword)
  const handleSearch = (query: string, mode: 'semantic' | 'keyword') => {
    setRateLimitNotice(null);
    if (!query.trim()) {
      handleTagFilter(activeTag);
      return;
    }

    startSearchTransition(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=${mode}`);
        const data = await res.json();

        if (res.status === 429) {
          setRateLimitNotice(data.error || 'Rate limit reached. Try keyword search.');
          return;
        }

        if (data.results && data.results.length > 0) {
          setFilteredPlaces(data.results);
        } else {
          setFilteredPlaces([]);
        }
      } catch (err: unknown) {
        console.error('Search error:', err);
      }
    });
  };

  // Calculate Haversine distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // "Near Me" GPS Locator
  const handleLocateNearMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);

        const sorted = [...filteredPlaces]
          .map((p) => ({
            ...p,
            distanceKm: calculateDistance(coords.lat, coords.lng, p.latitude, p.longitude),
          }))
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

        setFilteredPlaces(sorted);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err.message);
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  // Handle marker selection
  const handleSelectPlace = (place: PlaceItem) => {
    setSelectedPlace(place);
    // On mobile, open bottom drawer
    if (window.innerWidth < 1024) {
      setIsMobileDrawerOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur-md border-b border-border/80">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <UtensilsCrossed className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-1.5">
                PinChaat
                <Badge variant="secondary" className="text-[10px] uppercase font-semibold py-0 px-1.5 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  AI Maps
                </Badge>
              </span>
              <span className="text-[10px] text-muted-foreground -mt-0.5 hidden sm:inline">
                Community Cravings & Verified Street Food
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSuggestModalOpen(true)}
              className="text-xs gap-1.5 border-orange-200 hover:bg-orange-50 text-orange-700 dark:border-orange-900 dark:text-orange-300"
            >
              <PlusCircle data-icon="inline-start" />
              <span>Suggest Spot</span>
            </Button>

            <Link
              href="/admin"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-xs text-muted-foreground gap-1' })}
            >
              <Shield data-icon="inline-start" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Search Bar & AI Cravings Selector */}
        <SearchBar
          onSearch={handleSearch}
          onLocateNearMe={handleLocateNearMe}
          isLoading={isSearching}
          isLocating={isLocating}
          rateLimitWarning={rateLimitNotice}
        />

        {/* Quick Filter Tag Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All Spots' },
            { id: 'street food', label: '🌮 Street Food' },
            { id: 'chaat', label: '🌶️ Chaat' },
            { id: 'dosa', label: '🥞 South Indian' },
            { id: 'rolls', label: '🌯 Kathi Rolls' },
            { id: 'late-night', label: '🌙 Late Night' },
            { id: 'sweets', label: '🍯 Sweets & Chai' },
          ].map((tag) => (
            <Badge
              key={tag.id}
              variant={activeTag === tag.id ? 'default' : 'secondary'}
              onClick={() => handleTagFilter(tag.id)}
              className={`cursor-pointer whitespace-nowrap text-xs px-2.5 py-1 transition-colors ${
                activeTag === tag.id ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'hover:bg-muted'
              }`}
            >
              {tag.label}
            </Badge>
          ))}
        </div>

        {/* Mobile View Toggle Switch (Only visible on screens < lg) */}
        <div className="lg:hidden flex items-center justify-between p-1 bg-muted/60 rounded-lg border border-border text-xs">
          <Button
            type="button"
            variant={mobileView === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMobileView('list')}
            className={`flex-1 text-xs gap-1.5 ${mobileView === 'list' ? 'bg-orange-600 text-white' : ''}`}
          >
            <ListIcon data-icon="inline-start" />
            <span>List ({filteredPlaces.length})</span>
          </Button>
          <Button
            type="button"
            variant={mobileView === 'map' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMobileView('map')}
            className={`flex-1 text-xs gap-1.5 ${mobileView === 'map' ? 'bg-orange-600 text-white' : ''}`}
          >
            <MapIcon data-icon="inline-start" />
            <span>Map View</span>
          </Button>
        </div>

        {/* Responsive Dual Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[500px]">
          {/* Places Feed Column (Desktop: 7 cols, Mobile: depends on toggle) */}
          <section
            className={`lg:col-span-7 flex flex-col gap-3.5 ${
              mobileView === 'map' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Showing {filteredPlaces.length} foodie recommendations</span>
              {userLocation && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                  <Navigation className="size-3" /> Sorted by proximity
                </span>
              )}
            </div>

            {filteredPlaces.length === 0 ? (
              <Card className="border-dashed p-8 text-center flex flex-col items-center justify-center gap-3">
                <Compass className="size-10 text-muted-foreground/40" />
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold text-sm">
                    {places.length === 0 ? 'No foodie spots pinned yet' : 'No matching cravings found'}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {places.length === 0
                      ? 'The community map is ready! Suggest an unlisted gem or paste a Google Maps link to pin the first spot.'
                      : 'No spots match this craving or filter. You can suggest this spot to add it to the map!'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsSuggestModalOpen(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5"
                >
                  <PlusCircle data-icon="inline-start" />
                  Suggest this Spot
                </Button>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredPlaces.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    isSelected={selectedPlace?.id === place.id}
                    onSelect={() => handleSelectPlace(place)}
                    onOpenReviewModal={(p) => {
                      setSelectedPlace(p);
                      setIsReviewModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Map Column (Desktop: 5 cols, Mobile: depends on toggle) */}
          <section
            className={`lg:col-span-5 h-[450px] lg:h-[calc(100vh-180px)] lg:sticky lg:top-20 ${
              mobileView === 'list' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="w-full h-full flex flex-col">
              <DynamicFoodieMap
                places={filteredPlaces}
                selectedPlaceId={selectedPlace?.id}
                onSelectPlace={handleSelectPlace}
                userLocation={userLocation}
              />
            </div>
          </section>
        </div>
      </main>

      {/* Mobile Drawer (Bottom Sheet) when a place is tapped on the map */}
      <Drawer open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <DrawerContent className="p-4 flex flex-col gap-3">
          {selectedPlace && (
            <>
              <DrawerHeader className="p-0 text-left">
                <DrawerTitle className="text-base font-bold">{selectedPlace.name}</DrawerTitle>
                <DrawerDescription className="text-xs">{selectedPlace.address || 'Street Location'}</DrawerDescription>
              </DrawerHeader>

              {/* Spot Description */}
              {selectedPlace.description && (
                <p className="text-xs text-foreground/80 leading-relaxed font-normal">
                  {selectedPlace.description}
                </p>
              )}

              {selectedPlace.summary && (
                <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400 mb-0.5 text-[11px]">
                    <Sparkles className="size-3" /> Community Foodie Summary
                  </div>
                  {selectedPlace.summary}
                </div>
              )}

              {/* Patron Reviews in Drawer */}
              {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  <span className="text-xs font-bold text-foreground">
                    Patron Reviews ({selectedPlace.reviews.length})
                  </span>
                  {selectedPlace.reviews.map((r) => (
                    <div key={r.id} className="p-2 rounded-lg bg-muted/50 border border-border/60 text-xs flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{r.author_name || 'Anonymous'}</span>
                        <span className="text-amber-500 font-bold">{r.rating} ★</span>
                      </div>
                      <p className="italic text-foreground/80 leading-relaxed">"{r.content}"</p>
                      {r.must_try_dishes && r.must_try_dishes.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          Picks: {r.must_try_dishes.join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedPlace.tags?.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    #{t}
                  </Badge>
                ))}
              </div>

              <DrawerFooter className="p-0 pt-2 flex flex-row justify-between gap-2">
                {selectedPlace.google_maps_url && (
                  <a
                    href={selectedPlace.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: 'outline', size: 'sm', className: 'flex-1 text-xs gap-1' })}
                  >
                    Open Maps <ExternalLink data-icon="inline-end" />
                  </a>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsReviewModalOpen(true);
                  }}
                  className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1"
                >
                  <MessageSquarePlus data-icon="inline-start" />
                  Review Spot
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Review Submission Modal */}
      <ReviewModal
        place={selectedPlace}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
      />

      {/* Suggest Place Modal (with click-to-pin Leaflet picker) */}
      <SuggestPlaceModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
      />
    </div>
  );
}
