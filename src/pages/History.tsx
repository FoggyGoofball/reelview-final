'use client';

import React, { useState, useEffect } from 'react';
import { getWatchHistory } from '@/lib/client-api';
import type { WatchProgress } from '@/lib/data';
import { History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { WatchHistoryCard } from '@/components/video/watch-history-card';
import { DismissedCarousel } from '@/components/video/dismissed-carousel';

export default function WatchHistoryPage() {
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const rawHistory = getWatchHistory();
    // Sort by last_updated descending
    const sortedHistory = Object.values(rawHistory).sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
    setHistory(sortedHistory);
  }, []);

  if (!isMounted) {
    return (
        <div className="container max-w-screen-2xl py-8 md:py-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
                <History className="h-8 w-8 text-primary" /> Your Watch History
            </h1>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="aspect-[2/3] w-full rounded-lg bg-muted animate-pulse"></div>
                        <div className="h-5 w-3/4 rounded-md bg-muted animate-pulse"></div>
                    </div>
                ))}
            </div>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
        <History className="h-8 w-8 text-primary" /> Your Watch History
      </h1>
      {history.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {history.map((item, index) => (
             <div key={`${item.id}-${item.type}-${index}`} className="flex-shrink-0">
                <WatchHistoryCard item={item} />
             </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-secondary rounded-lg">
          <p className="text-lg text-muted-foreground">Your watch history is empty.</p>
          <p className="text-sm text-muted-foreground/70">Start watching videos to see them here.</p>
        </div>
      )}
      <div className="mt-12">
        <DismissedCarousel />
      </div>
    </div>
  );
}
