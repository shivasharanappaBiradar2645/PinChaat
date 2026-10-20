'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapPlace {
  id: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  summary?: string | null;
  price_level?: string | null;
  tags?: string[] | null;
  google_maps_url?: string | null;
}

interface FoodieMapProps {
  places: MapPlace[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: MapPlace) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function FoodieMap({
  places,
  selectedPlaceId,
  onSelectPlace,
  userLocation,
}: FoodieMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = places[0]?.latitude || 28.6139;
    const initialLng = places[0]?.longitude || 77.2090;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    // OpenStreetMap Standard Tiles (100% Free & Open-Source)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // User location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-md"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup('<b>You are here</b>')
        .addTo(markersGroup);
    }

    // Place Markers
    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const markerColor = isSelected ? 'bg-orange-600 ring-4 ring-orange-200' : 'bg-amber-500 hover:bg-orange-600';

      const customIcon = L.divIcon({
        className: 'custom-foodie-pin',
        html: `
          <div class="cursor-pointer transition-transform duration-200 hover:scale-110 flex items-center justify-center">
            <div class="${markerColor} text-white font-bold text-xs size-7 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              📍
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([place.latitude, place.longitude], { icon: customIcon });

      const popupContent = `
        <div style="font-family: sans-serif; min-width: 180px; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #1e293b;">${place.name}</h4>
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">${place.address || 'Address not listed'}</p>
          ${place.summary ? `<p style="margin: 0 0 6px 0; font-size: 11px; line-height: 1.3; color: #334155;">${place.summary.slice(0, 90)}...</p>` : ''}
          ${place.google_maps_url ? `<a href="${place.google_maps_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; font-size: 11px; color: #f97316; font-weight: 600; text-decoration: underline;">Open in Google Maps ↗</a>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        onSelectPlace?.(place);
      });

      marker.addTo(markersGroup);
    });

    // Fit bounds if markers exist
    if (markersGroup.getLayers().length > 0) {
      map.fitBounds(markersGroup.getBounds().pad(0.15), { maxZoom: 15 });
    }
  }, [places, selectedPlaceId, userLocation, onSelectPlace]);

  return (
    <div className="relative w-full h-full min-h-[350px] rounded-xl overflow-hidden border border-border shadow-xs">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '380px' }} />
    </div>
  );
}
