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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicMapPinPicker } from '@/components/map/DynamicMap';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface SuggestPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SuggestPlaceModal({ isOpen, onClose }: SuggestPlaceModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(28.6139);
  const [longitude, setLongitude] = useState(77.2090);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [priceLevel, setPriceLevel] = useState<'budget' | 'moderate' | 'expensive'>('budget');
  const [tags, setTags] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResolveMapsUrl = async (urlToResolve: string) => {
    if (!urlToResolve.trim()) return;
    setIsResolvingUrl(true);
    try {
      const res = await fetch('/api/resolve-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToResolve.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.latitude && data.longitude) {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        setStatusMessage({
          type: 'success',
          text: `Coordinates automatically detected from Google Maps (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})!`,
        });
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch (err: unknown) {
      console.warn('Could not auto-resolve Maps URL:', err);
    } finally {
      setIsResolvingUrl(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          latitude,
          longitude,
          google_maps_url: googleMapsUrl.trim() || null,
          price_level: priceLevel,
          tags,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit place suggestion');
      }

      setStatusMessage({
        type: 'success',
        text: 'Foodie spot suggested! The admin will review and add it to the map.',
      });

      setName('');
      setAddress('');
      setReason('');
      setTags('');
      setGoogleMapsUrl('');

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
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Suggest a Hidden Gem</DialogTitle>
          <DialogDescription className="text-xs">
            Found an unlisted street food stall, tea stall, or cafe? Drop a pin to suggest it.
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
          {/* Map Pin Dropper */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">1. Pin Location on Map</label>
            <DynamicMapPinPicker
              initialLat={latitude}
              initialLng={longitude}
              onPickCoordinates={(lat, lng, suggestedAddress) => {
                setLatitude(lat);
                setLongitude(lng);
                if (suggestedAddress && !address) {
                  setAddress(suggestedAddress);
                }
              }}
            />
          </div>

          {/* Place Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">
              Place / Stall Name <span className="text-red-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. Raju Chaat Bhandar or Corner Tea stall"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">Address / Landmark</label>
            <Input
              placeholder="e.g. Near Metro Pillar 140, Karol Bagh"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Price Level */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Price Level</label>
              <Select
                value={priceLevel}
                onValueChange={(val) => {
                  if (val) setPriceLevel(val as 'budget' | 'moderate' | 'expensive');
                }}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Select price level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">₹ Budget (under ₹150)</SelectItem>
                  <SelectItem value="moderate">₹₹ Moderate (₹150 - ₹500)</SelectItem>
                  <SelectItem value="expensive">₹₹₹ Splurge (₹500+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Tags (comma separated)</label>
              <Input
                placeholder="e.g. chaat, pani puri, evening"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Google Maps link with auto-coordinate detection */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Google Maps URL</label>
              {googleMapsUrl && (
                <button
                  type="button"
                  onClick={() => handleResolveMapsUrl(googleMapsUrl)}
                  disabled={isResolvingUrl}
                  className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  {isResolvingUrl ? 'Detecting coordinates...' : '⚡ Extract Pin Coordinates'}
                </button>
              )}
            </div>
            <Input
              placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
              value={googleMapsUrl}
              onChange={(e) => {
                const val = e.target.value;
                setGoogleMapsUrl(val);
                if (val.includes('maps.google.') || val.includes('goo.gl') || val.includes('google.com/maps')) {
                  handleResolveMapsUrl(val);
                }
              }}
              onBlur={() => {
                if (googleMapsUrl.trim()) handleResolveMapsUrl(googleMapsUrl);
              }}
              className="text-xs h-9"
            />
            <span className="text-[10px] text-muted-foreground">
              Pasting a Google Maps link will automatically extract latitude & longitude and place the pin.
            </span>
          </div>

          {/* Why Recommend */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">Why do you recommend this spot?</label>
            <Textarea
              rows={2}
              placeholder="Signature dish, specialty chutney, best time to visit..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
