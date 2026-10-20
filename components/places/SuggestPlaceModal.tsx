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
import { DynamicMapPinPicker } from '@/components/map/DynamicMap';
import { CheckCircle, AlertCircle, Clock, MapPin } from 'lucide-react';

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
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false);

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

      setIsSubmittedSuccessfully(true);
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
    setName('');
    setAddress('');
    setReason('');
    setTags('');
    setGoogleMapsUrl('');
    setIsSubmittedSuccessfully(false);
    setStatusMessage(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        {isSubmittedSuccessfully ? (
          <div className="flex flex-col items-center justify-center p-4 py-8 text-center gap-4">
            <div className="size-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center text-green-600">
              <CheckCircle className="size-8" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-extrabold text-lg text-foreground">Spot Submitted for Review!</h3>
              <p className="text-xs text-muted-foreground">
                Thank you for contributing to the PinChaat community.
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-left max-w-md">
              <Clock className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-xs text-amber-900 dark:text-amber-100">
                  Moderation Required
                </span>
                <span className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  To prevent spam and keep reviews 100% genuine, all suggested spots are held in the moderation queue. The admin will verify and approve <strong>{name}</strong> before it appears publicly on the map.
                </span>
              </div>
            </div>

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
              <DialogTitle className="text-lg">Suggest a Hidden Gem</DialogTitle>
              <DialogDescription className="text-xs">
                Found an unlisted street food stall, tea stall, or cafe? Suggest it so other foodies can discover it.
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
              {/* Google Maps link with auto-coordinate detection */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Google Maps URL (Recommended)</label>
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
                  Pasting a link will auto-extract latitude & longitude and set the map pin.
                </span>
              </div>

              {/* Map Pin Dropper */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Or Click to Adjust Pin on Map</label>
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

              {/* Clean Touch-Friendly Budget Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Budget / Price Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'budget', label: '₹ Budget', sub: '< ₹150' },
                    { id: 'moderate', label: '₹₹ Moderate', sub: '₹150 - ₹500' },
                    { id: 'expensive', label: '₹₹₹ Splurge', sub: '₹500+' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPriceLevel(opt.id as 'budget' | 'moderate' | 'expensive')}
                      className={`p-2 rounded-lg border text-left flex flex-col transition-all cursor-pointer ${
                        priceLevel === opt.id
                          ? 'border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200 ring-1 ring-orange-500'
                          : 'border-border bg-card hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <span className="font-semibold text-xs text-foreground">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Food Tags (comma separated)</label>
                <Input
                  placeholder="e.g. wadapav, misalpav, chai, evening snacks"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* Why Recommend */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">What makes this spot special? (Description)</label>
                <Textarea
                  rows={2}
                  placeholder="Signature dish, specialty chutney, best time to visit, prices..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !name.trim()}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Spot for Approval'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
