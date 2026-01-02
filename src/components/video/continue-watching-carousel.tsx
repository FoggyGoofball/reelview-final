'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWatchHistory, enrichVideoDetails } from '@/lib/client-api';
import type { WatchProgress } from '@/lib/data';
import { WatchHistoryCard } from './watch-history-card';
import { ChevronRight } from 'lucide-react';
import { useDismissed } from '@/context/dismissed-context';

export function ContinueWatchingCarousel() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { dismissedItems } = useDismissed();

  const updateHistory = async () => {
    try {
      const rawHistory = getWatchHistory();
      
      const sortedHistory = Object.values(rawHistory)
        .filter(item => {
          if (!item || !item.id || !item.type) return false;
          const dismissedKey = `${item.type}-${item.id}`;
          const malDismissedKey = item.mal_id ? `${item.type}-${item.mal_id}` : null;
          if (dismissedItems[dismissedKey] || (malDismissedKey && dismissedItems[malDismissedKey])) {
            return false;
          }
          if (!item?.progress?.watched || !item?.progress?.duration) return false;
          const percentage = (item.progress.watched / item.progress.duration) * 100;
          // Keep shows in continue watching until they are done, movies are removed earlier.
          if (item.type === 'tv' || item.type === 'anime') return percentage < 98;
          return percentage < 95;
        })
        .sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
      
      setHistory(sortedHistory);
      
      // Enrich items asynchronously without blocking
      Promise.all(sortedHistory.map(item => enrichVideoDetails(item)))
        .then(enrichedItems => {
          setHistory(enrichedItems);
        })
        .catch(err => {
          console.error('[CONTINUE WATCHING] Error enriching items:', err);
          // Keep original items if enrichment fails
        });
    } catch (error) {
      console.error('[CONTINUE WATCHING] Error updating history:', error);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    updateHistory(); 

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'vidLinkProgress' || event.key === 'vidLinkDismissed') {
        updateHistory();
      }
    };

    const handleHistoryUpdate = () => {
        updateHistory();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('history-updated', handleHistoryUpdate);
    window.addEventListener('dismissed-updated', handleHistoryUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('history-updated', handleHistoryUpdate);
      window.removeEventListener('dismissed-updated', handleHistoryUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedItems]);

  if (!isMounted || history.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 py-8 md:py-12" aria-labelledby="continue-watching-heading">
      <div className="container max-w-screen-2xl">
        <button 
          onClick={() => navigate('/history')}
          className="bg-none border-none p-0 cursor-pointer"
        >
          <h2 id="continue-watching-heading" className="text-2xl font-bold tracking-tight text-red-500 flex items-center hover:text-red-600 transition-colors">
            Continue Watching
            <ChevronRight className="h-6 w-6 text-red-500 ml-2" />
          </h2>
        </button>
      </div>
      <div className="relative">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 pl-4 sm:pl-6 lg:pl-8">
            {history.map((item, index) => (
              <div key={`${item.id}-${item.type}-${index}`} className="w-40 sm:w-48 md:w-56 flex-shrink-0">
                <WatchHistoryCard item={item} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
