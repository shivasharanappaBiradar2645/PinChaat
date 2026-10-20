'use client';

import { useState } from 'react';
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
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!place) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          author_name: authorName.trim() || 'Anonymous Foodie',
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

      setStatusMessage({
        type: 'success',
        text: 'Review submitted anonymously! It will appear once approved by the admin.',
      });

      // Clear form
      setContent('');
      setMustTryDishes('');
      setPricePaid('');

      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 2000);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: (err as Error).message || 'Something went wrong.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
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

          <div className="flex justify-end gap-2 mt-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
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
      </DialogContent>
    </Dialog>
  );
}
