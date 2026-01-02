'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getWatchlist, addToWatchlist as apiAddToWatchlist, removeFromWatchlist as apiRemoveFromWatchlist } from '@/lib/client-api';
import type { Video } from '@/lib/data';

interface WatchlistContextType {
  watchlist: Record<string, Video>;
  addToWatchlist: (video: Video) => void;
  removeFromWatchlist: (videoId: string, mediaType: 'movie' | 'tv' | 'anime') => void;
  isInWatchlist: (videoId: string, mediaType: 'movie' | 'tv' | 'anime') => boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<Record<string, Video>>({});

  useEffect(() => {
    // Initialize state once on mount
    setWatchlist(getWatchlist());

    const handleStorageChange = (event: StorageEvent) => {
      // This handles updates from other tabs
      if (event.key === 'vidLinkWatchlist') {
        setWatchlist(getWatchlist());
      }
    };
    
    const handleWatchlistUpdate = (event: Event) => {
        // This handles updates from the current tab via client-api
        setWatchlist((event as CustomEvent).detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('watchlist-updated', handleWatchlistUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('watchlist-updated', handleWatchlistUpdate);
    };
  }, []);

  const addToWatchlist = useCallback((video: Video) => {
    // Let the API function handle the state update and event dispatch
    apiAddToWatchlist(video);
  }, []);

  const removeFromWatchlist = useCallback((videoId: string, mediaType: 'movie' | 'tv' | 'anime') => {
    // Let the API function handle the state update and event dispatch
    apiRemoveFromWatchlist(videoId, mediaType);
  }, []);

  const isInWatchlist = useCallback((videoId: string, mediaType: 'movie' | 'tv' | 'anime') => {
    const key = `${mediaType}-${videoId}`;
    return key in watchlist;
  }, [watchlist]);

  return (
    <WatchlistContext.Provider value={{ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}
