import React from 'react';
import type { Category, Video } from '@/lib/data';
import { VideoCard } from './video-card';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { ViewMoreCard } from './view-more-card';
import { useNavigate } from 'react-router-dom';

interface VideoCarouselProps {
  category: Category;
  videos: Video[];
  isLoading?: boolean;
  onDismiss?: (video: Video) => void;
  href?: string;
  hasMore?: boolean;
}

function VideoCarouselComponent({ category, videos, isLoading, onDismiss, href, hasMore }: VideoCarouselProps) {
  const navigate = useNavigate();

  const handleViewMore = () => {
    // prefer explicit href with querystring; also pass state as fallback
    if (href) {
      navigate(href, { state: { genreId: category.id, genreName: category.name, isKeyword: !!category.is_keyword } });
    } else {
      // fallback to route with state only
      const base = `/${category.is_keyword ? 'anime' : 'movies'}`;
      navigate(`${base}/genre`, { state: { genreId: category.id, genreName: category.name, isKeyword: !!category.is_keyword } });
    }
  };

  const TitleContent = () => (
    <div className="flex items-center gap-2 group">
      <h2 id={`category-${category.id}-heading`} className="text-2xl font-bold tracking-tight text-red-500 group-hover:text-red-600 transition-colors">
        {category.name}
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground ml-2" />}
      </h2>
      { (href || true) && (
        <button
          className="ml-2 p-1 rounded-full hover:bg-red-600/20 transition-colors"
          onClick={handleViewMore}
          aria-label={`View more ${category.name}`}
        >
          <ChevronRight className="h-6 w-6 text-red-500 group-hover:text-red-600 transition-colors" />
        </button>
      )}
    </div>
  );

  return (
    <section className="space-y-4" aria-labelledby={`category-${category.id}-heading`}>
      <div className="container max-w-screen-2xl">
        <TitleContent />
      </div>
      <div className="relative">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 px-4 sm:px-6 lg:px-8">
            {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={cn("w-40 sm:w-48 md:w-56 flex-shrink-0 space-y-2")}>
                         <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                         <Skeleton className="h-5 w-3/4 rounded-md" />
                    </div>
                ))
            ) : (
              <>
                {videos.map((video) => (
                <div key={`${category.id}-${video.id}`} className={cn("w-40 sm:w-48 md:w-56 flex-shrink-0")}>
                    <VideoCard video={video} onDismiss={onDismiss} />
                </div>
                ))}
                {hasMore && (
                  <div className={cn("w-40 sm:w-48 md:w-56 flex-shrink-0 flex items-center justify-center")}>
                    <button
                      className="rounded-full p-3 hover:bg-red-600/20 transition-colors"
                      onClick={handleViewMore}
                      aria-label="View More"
                    >
                      <ChevronRight className="h-8 w-8 text-red-500" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const VideoCarousel = React.memo(VideoCarouselComponent);
