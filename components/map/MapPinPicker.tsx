'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';

interface MapPinPickerProps {
  initialLat?: number;
  initialLng?: number;
  onPickCoordinates: (lat: number, lng: number, addressSuggestion?: string) => void;
}

export default function MapPinPicker({
  initialLat = 28.6139,
  initialLng = 77.2090,
  onPickCoordinates,
}: MapPinPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
    });

    // OpenStreetMap Standard Tiles (100% Free & Open-Source)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'picker-pin',
      html: `
        <div class="cursor-grab size-8 bg-red-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-base">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Handle marker drag
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setCurrentCoords({ lat: pos.lat, lng: pos.lng });
      onPickCoordinates(pos.lat, pos.lng);
    });

    // Handle map click
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCurrentCoords({ lat, lng });
      onPickCoordinates(lat, lng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialLat, initialLng, onPickCoordinates]);

  // Free Nominatim Geocoding
  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lon], 16);
          markerRef.current.setLatLng([lat, lon]);
          setCurrentCoords({ lat, lng: lon });
          onPickCoordinates(lat, lon, first.display_name);
        }
      }
    } catch (err: unknown) {
      console.error('Nominatim search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <form onSubmit={handleAddressSearch} className="flex gap-2">
        <Input
          placeholder="Search street, area, or city (e.g. Connaught Place, Delhi)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={isSearching}>
          <Search className="size-4 mr-1" />
          {isSearching ? 'Searching...' : 'Locate'}
        </Button>
      </form>

      <div className="relative w-full h-[260px] rounded-lg overflow-hidden border border-border">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <MapPin className="size-3 text-red-500" /> Click or drag the pin to set spot coordinates.
        </span>
        <span className="font-mono bg-muted px-2 py-0.5 rounded">
          {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
