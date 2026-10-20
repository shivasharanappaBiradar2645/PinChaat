'use client';

import dynamic from 'next/dynamic';

export const DynamicFoodieMap = dynamic(() => import('./FoodieMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[380px] rounded-xl bg-muted/40 animate-pulse flex items-center justify-center border border-border">
      <span className="text-sm text-muted-foreground font-medium">Loading OpenStreetMap...</span>
    </div>
  ),
});

export const DynamicMapPinPicker = dynamic(() => import('./MapPinPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[260px] rounded-lg bg-muted/40 animate-pulse flex items-center justify-center border border-border">
      <span className="text-xs text-muted-foreground">Loading Pin Picker...</span>
    </div>
  ),
});
