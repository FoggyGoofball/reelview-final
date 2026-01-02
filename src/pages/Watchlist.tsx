'use client';

import React, { useState, useEffect } from 'react';
import type { Video } from '@/lib/data';
import { ListVideo, ListX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoCard } from '@/components/video/video-card';
import { useWatchlist } from '@/context/watchlist-context';
import { Header } from '@/components/layout/header';

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const watchlistItems = Object.values(watchlist);

  if (!isMounted) {
    return (
      <div>
        <Header />
        <div className="container max-w-screen-2xl py-8 md:py-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
                <ListVideo className="h-8 w-8 text-primary" /> Your Watchlist
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                        <Skeleton className="h-5 w-3/4 rounded-md" />
                    </div>
                ))}
            </div>
      </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="container max-w-screen-2xl py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
          <ListVideo className="h-8 w-8 text-primary" /> Your Watchlist
        </h1>
        {watchlistItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
            {watchlistItems.map((video) => (
               <VideoCard key={`${video.id}-${video.media_type}`} video={video} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-secondary rounded-lg">
            <ListX className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">Your watchlist is empty.</p>
            <p className="text-sm text-muted-foreground/70">Add movies and shows to your watchlist to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
