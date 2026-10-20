'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  ExternalLink,
  MessageSquarePlus,
  Sparkles,
  IndianRupee,
  Star,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';

export interface ReviewItem {
  id: string;
  author_name?: string | null;
  rating: number;
  content: string;
  must_try_dishes?: string[] | null;
  price_paid?: number | null;
  created_at?: string;
}

export interface PlaceItem {
  id: string;
  name: string;
  description?: string | null;
  summary?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  google_maps_url?: string | null;
  price_level?: string | null;
  average_cost_per_person?: number | null;
  tags?: string[] | null;
  distanceKm?: number;
  relevanceScore?: number;
  reviews?: ReviewItem[];
  matchedReviews?: Array<{
    content: string;
    must_try_dishes?: string[];
    similarity?: number;
  }>;
}

interface PlaceCardProps {
  place: PlaceItem;
  isSelected?: boolean;
  onSelect?: () => void;
  onOpenReviewModal: (place: PlaceItem) => void;
}

export default function PlaceCard({
  place,
  isSelected,
  onSelect,
  onOpenReviewModal,
}: PlaceCardProps) {
  const [showReviews, setShowReviews] = useState(false);

  const priceDisplay =
    place.price_level === 'budget' ? '₹ (Budget)' : place.price_level === 'expensive' ? '₹₹₹ (Splurge)' : '₹₹ (Moderate)';

  const approvedReviews = place.reviews || [];
  const reviewCount = approvedReviews.length;
  const avgRating =
    reviewCount > 0
      ? (approvedReviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviewCount).toFixed(1)
      : null;

  return (
    <Card
      onClick={onSelect}
      className={`cursor-pointer transition-all duration-200 border ${
        isSelected
          ? 'border-orange-500 shadow-md ring-2 ring-orange-200 dark:ring-orange-950'
          : 'border-border hover:border-orange-300 dark:hover:border-orange-800 shadow-xs'
      }`}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Header: Name, Rating, Distance & Price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-foreground leading-snug">{place.name}</h3>
              {avgRating && (
                <Badge variant="secondary" className="text-xs font-semibold gap-1 px-1.5 py-0 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <Star className="size-3 fill-amber-500 text-amber-500 inline" />
                  {avgRating} ({reviewCount})
                </Badge>
              )}
            </div>
            {place.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="size-3 shrink-0 text-muted-foreground" />
                <span>{place.address}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-xs font-medium border-border">
              {priceDisplay}
            </Badge>
            {place.distanceKm !== undefined && (
              <span className="text-[11px] font-mono font-medium text-blue-600 dark:text-blue-400">
                {place.distanceKm.toFixed(1)} km away
              </span>
            )}
          </div>
        </div>

        {/* Spot Description */}
        {place.description && (
          <p className="text-xs text-foreground/80 leading-relaxed font-normal">
            {place.description}
          </p>
        )}

        {/* AI Rolling Summary */}
        {place.summary && (
          <div className="p-2.5 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 text-xs text-foreground/90 leading-relaxed">
            <div className="flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400 mb-1 text-[11px]">
              <Sparkles className="size-3" /> Community Foodie Summary
            </div>
            {place.summary}
          </div>
        )}

        {/* Semantic Match Excerpt (if applicable) */}
        {place.matchedReviews && place.matchedReviews.length > 0 && (
          <div className="p-2 rounded-md bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 text-xs">
            <span className="font-medium text-amber-700 dark:text-amber-400">Top matched review: </span>
            <span className="italic text-muted-foreground">
              "{place.matchedReviews[0].content.slice(0, 110)}..."
            </span>
            {place.matchedReviews[0].must_try_dishes && place.matchedReviews[0].must_try_dishes.length > 0 && (
              <div className="mt-1 text-[11px] text-foreground/80">
                <span className="font-semibold">Patron picks: </span>
                {place.matchedReviews[0].must_try_dishes.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {place.tags && place.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {place.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] px-2 py-0">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Reviews Section Toggle */}
        {reviewCount > 0 && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviews(!showReviews);
              }}
              className="flex items-center justify-between w-full text-xs font-semibold text-orange-700 dark:text-orange-400 hover:underline py-0.5"
            >
              <span>Patron Reviews ({reviewCount})</span>
              {showReviews ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showReviews && (
              <div className="flex flex-col gap-2.5 mt-1">
                {approvedReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-2.5 rounded-lg bg-muted/40 border border-border/70 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{rev.author_name || 'Anonymous Foodie'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <span>{rev.rating}</span>
                        <Star className="size-3 fill-amber-400 text-amber-500" />
                      </div>
                    </div>

                    <p className="text-foreground/90 leading-relaxed italic">"{rev.content}"</p>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 flex-wrap gap-1">
                      {rev.must_try_dishes && rev.must_try_dishes.length > 0 && (
                        <span>
                          <strong className="text-foreground/80">Must-Try:</strong> {rev.must_try_dishes.join(', ')}
                        </span>
                      )}
                      {rev.price_paid && (
                        <span className="font-mono bg-muted px-1.5 py-0.2 rounded">
                          Paid: ₹{rev.price_paid}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
          {place.average_cost_per_person ? (
            <span className="flex items-center text-muted-foreground font-medium text-[11px]">
              <IndianRupee className="size-3" />
              ~{place.average_cost_per_person} per person
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {reviewCount === 0 ? 'No reviews yet' : ''}
            </span>
          )}

          <div className="flex items-center gap-2">
            {place.google_maps_url && (
              <a
                href={place.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'xs',
                  className: 'text-muted-foreground hover:text-foreground gap-1',
                })}
              >
                Maps <ExternalLink data-icon="inline-end" />
              </a>
            )}

            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReviewModal(place);
              }}
              className="gap-1 border-orange-200 hover:bg-orange-50 text-orange-700 dark:border-orange-900 dark:text-orange-400"
            >
              <MessageSquarePlus data-icon="inline-start" />
              Review
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
