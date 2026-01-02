'use client';

import React, { useEffect, useState } from 'react';
import { useDismissed } from '@/context/dismissed-context';
import { ChevronRight, ThumbsUp } from 'lucide-react';
import type { Video } from '@/lib/data';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

export function DismissedCarousel() {
  const { dismissedItems, unDismissItem } = useDismissed();
  const [isMounted, setIsMounted] = useState(false);
  const [dismissedVideos, setDismissedVideos] = useState<Video[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setDismissedVideos(Object.values(dismissedItems));
  }, [dismissedItems]);

  if (!isMounted || dismissedVideos.length === 0) {
    return null;
  }
  
  const handleRestore = (e: React.MouseEvent, video: Video) => {
    e.preventDefault();
    e.stopPropagation();
    unDismissItem(video);
    setDismissedVideos(current => current.filter(v => v.id !== video.id || v.media_type !== video.media_type));
  }


  return (
    <section className="space-y-4 py-8 md:py-12" aria-labelledby="dismissed-heading">
      <div className="container max-w-screen-2xl">
        <h2 id="dismissed-heading" className="text-2xl font-bold tracking-tight text-foreground flex items-center">
          Dismissed Items
          <ChevronRight className="h-6 w-6 text-primary" />
        </h2>
      </div>
       <div className="relative">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 pl-4 sm:pl-6 lg:pl-8">
            {dismissedVideos
              .filter(video => video && video.id && video.media_type) 
              .map((video) => {
                 const imageUrl = video.poster_path && video.poster_path.startsWith('http')
                    ? video.poster_path
                    : `https://image.tmdb.org/t/p/w500${video.poster_path}`;
                 const detailHref = `/media/${video.id}?type=${video.media_type}`;
                return (
                  <div key={`${video.id}-${video.media_type}`} className="w-40 sm:w-48 md:w-56 flex-shrink-0 group">
                     <div className="relative">
                        <a href={detailHref} >
                          <Card className="overflow-hidden border-2 border-transparent group-hover:border-primary transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-primary/20">
                            <div className="aspect-[2/3] relative bg-secondary">
                                <img
                                  src={imageUrl}
                                  alt={`Thumbnail for ${video.title}`}
                                  className="object-cover"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  data-ai-hint={'movie poster'}
                                />
                            </div>
                          </Card>
                        </a>
                        <div className="absolute top-2 right-2 z-10 flex flex-col items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => handleRestore(e, video)}
                                            className="text-white bg-yellow-600 hover:bg-yellow-500"
                                            aria-label="Restore this item"
                                        >
                                            <ThumbsUp className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                    <p>Restore this item</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                      </div>
                      <div className='mt-2 space-y-1'>
                        <a href={detailHref} >
                            <h3 className="text-sm font-medium text-foreground truncate transition-colors group-hover:text-primary">
                            {video.title}
                            </h3>
                        </a>
                      </div>
                  </div>
                )
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
