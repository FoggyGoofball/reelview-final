'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDismissedItems, addToDismissed as apiAddToDismissed, removeFromDismissed as apiRemoveFromDismissed } from '@/lib/client-api';
import type { Video } from '@/lib/data';

interface DismissedContextType {
  dismissedItems: Record<string, Video>;
  dismissItem: (video: Video) => void;
  unDismissItem: (video: Video) => void;
  isDismissed: (videoId: string, mediaType: 'movie' | 'tv' | 'anime') => boolean;
  addToDismissed: (video: Video) => void;
}

const DismissedContext = createContext<DismissedContextType | undefined>(undefined);

export function DismissedProvider({ children }: { children: React.ReactNode }) {
  const [dismissedItems, setDismissedItems] = useState<Record<string, Video>>({});

  useEffect(() => {
    // Initialize state once on mount from localStorage
    setDismissedItems(getDismissedItems());

    const handleStorageChange = (event: StorageEvent) => {
      // Listen for changes from other tabs
      if (event.key === 'vidLinkDismissed') {
        setDismissedItems(getDismissedItems());
      }
    };
    
    const handleDismissedUpdate = (event: Event) => {
      // Listen for changes from the current tab dispatched by client-api
      setDismissedItems((event as CustomEvent).detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('dismissed-updated', handleDismissedUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dismissed-updated', handleDismissedUpdate);
    };
  }, []);

  const dismissItem = useCallback((video: Video) => {
    // The API function will update localStorage and dispatch the event
    apiAddToDismissed(video);
  }, []);
  
  const unDismissItem = useCallback((video: Video) => {
    // The API function will update localStorage and dispatch the event
    apiRemoveFromDismissed(video);
  }, []);

  const addToDismissed = useCallback((video: Video) => {
    apiAddToDismissed(video);
  }, []);

  const isDismissed = useCallback((videoId: string, mediaType: 'movie' | 'tv' | 'anime') => {
    const key = `${mediaType}-${videoId}`;
    return key in dismissedItems;
  }, [dismissedItems]);

  return (
    <DismissedContext.Provider value={{ dismissedItems, dismissItem, unDismissItem, isDismissed, addToDismissed }}>
      {children}
    </DismissedContext.Provider>
  );
}

export function useDismissed() {
  const context = useContext(DismissedContext);
  if (context === undefined) {
    throw new Error('useDismissed must be used within a DismissedProvider');
  }
  return context;
}
