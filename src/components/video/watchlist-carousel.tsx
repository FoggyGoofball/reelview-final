'use client';

import React, { useState, useEffect } from 'react';
import { useWatchlist } from '@/context/watchlist-context';
import { VideoCard } from './video-card';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { enrichVideoDetails } from '@/lib/client-api';
import type { Video } from '@/lib/data';
import { useDismissed } from '@/context/dismissed-context';

export function WatchlistCarousel() {
  const navigate = useNavigate();
  const { watchlist } = useWatchlist();
  const { dismissedItems } = useDismissed();
  const [isMounted, setIsMounted] = useState(false);
  const [enrichedWatchlist, setEnrichedWatchlist] = useState<Video[]>([]);

  useEffect(() => {
    setIsMounted(true);
    const initialItems = Object.values(watchlist).filter(v => !dismissedItems[`${v.media_type}-${v.id}`]);
    setEnrichedWatchlist(initialItems);

    for (const item of initialItems) {
        if (!item.rating) {
            enrichVideoDetails(item).then(enrichedItem => {
                setEnrichedWatchlist(prevWatchlist =>
                    prevWatchlist.map(w => (w.id === enrichedItem.id && w.media_type === enrichedItem.media_type) ? enrichedItem : w)
                );
            });
        }
    }
  }, [watchlist, dismissedItems]);

  const handleDismiss = (video: Video) => {
    setEnrichedWatchlist(prev => prev.filter(v => v.id !== video.id || v.media_type !== video.media_type));
  };
  
  if (!isMounted || enrichedWatchlist.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 py-8 md:py-12" aria-labelledby="watchlist-heading">
      <div className="container max-w-screen-2xl">
        <button 
          onClick={() => navigate('/watchlist')}
          className="bg-none border-none p-0 cursor-pointer"
        >
          <h2 id="watchlist-heading" className="text-2xl font-bold tracking-tight text-red-500 flex items-center hover:text-red-600 transition-colors">
            Your Watchlist
            <ChevronRight className="h-6 w-6 text-red-500 ml-2" />
          </h2>
        </button>
      </div>
       <div className="relative">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 pl-4 sm:pl-6 lg:pl-8">
            {enrichedWatchlist.map((video) => (
              <div key={`${video.id}-${video.media_type}`} className="w-40 sm:w-48 md:w-56 flex-shrink-0">
                <VideoCard video={video} onDismiss={handleDismiss} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
