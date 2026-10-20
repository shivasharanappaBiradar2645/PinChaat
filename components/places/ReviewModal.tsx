'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Star, CheckCircle, AlertCircle } from 'lucide-react';
import { PlaceItem } from './PlaceCard';

interface ReviewModalProps {
  place: PlaceItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReviewModal({ place, isOpen, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [mustTryDishes, setMustTryDishes] = useState('');
  const [pricePaid, setPricePaid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAdminPosted, setIsAdminPosted] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [showAdminInput, setShowAdminInput] = useState(false);

  // Check if admin token is stored in localStorage
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('pinchaat_admin_token');
      if (savedToken) {
        setAdminToken(savedToken);
      }
    } catch (_) {}
  }, []);

  if (!place) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken.trim()) {
      headers['x-admin-token'] = adminToken.trim();
    }

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          place_id: place.id,
          author_name: authorName.trim() || (adminToken ? 'Admin' : 'Anonymous Foodie'),
          rating,
          content: content.trim(),
          must_try_dishes: mustTryDishes,
          price_paid: pricePaid ? parseFloat(pricePaid) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setIsAdminPosted(!!data.isAdmin);
      setIsSubmittedSuccessfully(true);
      setContent('');
      setMustTryDishes('');
      setPricePaid('');
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: (err as Error).message || 'Something went wrong.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmittedSuccessfully(false);
    setStatusMessage(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {isSubmittedSuccessfully ? (
          <div className="flex flex-col items-center justify-center p-4 py-8 text-center gap-4">
            <div className="size-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center text-green-600">
              <CheckCircle className="size-8" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-extrabold text-lg text-foreground">
                {isAdminPosted ? 'Review Published & Vectorized!' : 'Review Submitted!'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Your foodie notes for <strong>{place.name}</strong> are on their way.
              </p>
            </div>

            {isAdminPosted ? (
              <div className="p-3.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-900 dark:text-green-200 flex items-start gap-2.5 text-left max-w-md">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-xs text-green-900 dark:text-green-100">
                    ⚡ Instant Admin Publication & AI Embedding
                  </span>
                  <span className="text-[11px] leading-relaxed text-green-800 dark:text-green-300">
                    Posted as Admin with zero cooldown limits! This review is now live on the public map and immediately indexed into Gemini vector search.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-left max-w-md">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-xs text-amber-900 dark:text-amber-100">
                    ⏳ Awaiting Admin Approval
                  </span>
                  <span className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    To ensure quality, all reviews are held in the admin moderation queue. Once approved, your review will appear publicly on this spot and be vectorized into our AI cravings search!
                  </span>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleClose}
              className="mt-2 text-xs bg-orange-600 hover:bg-orange-700 text-white px-6"
            >
              Got it, thanks!
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
          <DialogTitle className="text-lg">Review {place.name}</DialogTitle>
          <DialogDescription className="text-xs">
            Share what you ate and if it was worth the hype. No login required.
          </DialogDescription>
        </DialogHeader>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/30 dark:text-green-300'
                : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="size-4 shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-2">
          {/* Star Rating */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">Rating</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`size-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-medium text-muted-foreground ml-2">
                {rating === 5 ? 'Must Visit 🔥' : rating === 4 ? 'Pretty Good 👍' : rating === 3 ? 'Decent' : 'Avoid'}
              </span>
            </div>
          </div>

          {/* Review Content */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">
              Review & Flavor Notes <span className="text-red-500">*</span>
            </label>
            <Textarea
              required
              rows={3}
              placeholder="What made this place stand out? How was the crispiness, spice level, or atmosphere?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Must Try Dishes */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">Must-Try Dishes (comma separated)</label>
            <Input
              placeholder="e.g. Malai Chaap, Butter Naan, Mango Kulfi"
              value={mustTryDishes}
              onChange={(e) => setMustTryDishes(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Price Paid */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Approx. Cost / Person (₹)</label>
              <Input
                type="number"
                placeholder="e.g. 150"
                value={pricePaid}
                onChange={(e) => setPricePaid(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Author Nickname */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Your Nickname (optional)</label>
              <Input
                placeholder="e.g. SpiceLover"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Admin Mode Toggle / Indicator */}
          <div className="flex flex-col gap-1.5 p-2.5 bg-muted/40 rounded-lg border border-border/70 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                {adminToken ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                    🛡️ Admin Mode Active (Unlimited, Instant Publish)
                  </span>
                ) : (
                  <span>Posting as Admin?</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowAdminInput(!showAdminInput)}
                className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline"
              >
                {showAdminInput ? 'Hide' : adminToken ? 'Change Token' : 'Enter Admin Token'}
              </button>
            </div>
            {showAdminInput && (
              <Input
                type="password"
                placeholder="Enter ADMIN_ACCESS_TOKEN for unlimited reviews..."
                value={adminToken}
                onChange={(e) => {
                  setAdminToken(e.target.value);
                  try {
                    localStorage.setItem('pinchaat_admin_token', e.target.value.trim());
                  } catch (_) {}
                }}
                className="text-xs h-8 mt-1"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
