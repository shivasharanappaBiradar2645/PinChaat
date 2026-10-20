'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, Navigation, X, AlertCircle } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string, mode: 'semantic' | 'keyword') => void;
  onLocateNearMe: () => void;
  isLoading: boolean;
  isLocating: boolean;
  rateLimitWarning?: string | null;
}

export default function SearchBar({
  onSearch,
  onLocateNearMe,
  isLoading,
  isLocating,
  rateLimitWarning,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'semantic' | 'keyword'>('semantic');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim(), mode);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('', mode);
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Mode Selector and Quick Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMode('semantic')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'semantic'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>AI Cravings Search</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('keyword')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'keyword'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="size-3.5" />
            <span>Keyword & Tags</span>
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLocateNearMe}
          disabled={isLocating}
          className="text-xs h-7 gap-1"
        >
          <Navigation className={`size-3.5 ${isLocating ? 'animate-spin text-blue-500' : 'text-blue-500'}`} />
          {isLocating ? 'Locating...' : 'Near Me'}
        </Button>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSubmit} className="relative flex items-center w-full">
        <div className="absolute left-3.5 pointer-events-none text-muted-foreground">
          {mode === 'semantic' ? (
            <Sparkles className="size-4 text-amber-500" />
          ) : (
            <Search className="size-4" />
          )}
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === 'semantic'
              ? "Describe your craving (e.g. 'extra crispy masala dosa with spicy podi', 'midnight comfort rolls')..."
              : "Search place name, dishes, or tags (e.g. 'samosa', 'chaat', 'kathi roll')..."
          }
          className="pl-10 pr-24 h-11 text-sm bg-background border-border shadow-xs focus-visible:ring-amber-400"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !query.trim()}
            className="h-8 px-3 text-xs bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {/* Rate Limit Alert */}
      {rateLimitWarning && (
        <div className="flex items-center gap-2 p-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>{rateLimitWarning}</span>
        </div>
      )}

      {/* Popular Suggestions Bar */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Try:</span>
        {[
          'Crispy Butter Dosa',
          'Hot Samosa Chaat',
          'Midnight Kathi Rolls',
          'Filter Coffee',
          'Pani Puri & Papdi',
        ].map((craving) => (
          <Badge
            key={craving}
            variant="secondary"
            onClick={() => {
              setQuery(craving);
              onSearch(craving, mode);
            }}
            className="cursor-pointer hover:bg-muted font-normal text-xs py-0.5"
          >
            {craving}
          </Badge>
        ))}
      </div>
    </div>
  );
}
