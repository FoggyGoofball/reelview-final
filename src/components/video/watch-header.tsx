'use client';

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/video/download-button';
import type { Video } from '@/lib/data';

export interface WatchHeaderProps {
  video: Video;
  currentSeason: number;
  currentEpisode: number;
  onNext: () => void;
  onPrev: () => void;
  onOpenEpisodes: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  playerUrl: string;
}

export function WatchHeader({
  video,
  currentSeason,
  currentEpisode,
  onNext,
  onPrev,
  onOpenEpisodes,
  hasNext,
  hasPrev,
  playerUrl,
}: WatchHeaderProps) {
  const navigate = useNavigate();
  const isSeries = video.media_type === 'tv' || video.media_type === 'anime';

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent p-2 sm:p-3 lg:p-4 text-white">
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Top Row: Back + Title + Controls */}
        <div className="flex items-center justify-between gap-2 min-h-[40px]">
          {/* Back Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleGoBack}
            className="rounded-full flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
            aria-label="Go back"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {/* Title - Flexible, truncates if needed */}
          <div className="flex-1 min-w-0 px-2">
            <h1 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate">{video.title}</h1>
            {isSeries && (
              <p className="text-xs sm:text-sm text-gray-300 truncate">
                S{currentSeason}E{currentEpisode}
              </p>
            )}
          </div>

          {/* Download Button - Always visible, never wraps */}
          <div className="flex-shrink-0">
            <DownloadButton />
          </div>
        </div>

        {/* Bottom Row: Series Controls - Always visible inline, never wraps to hamburger menu */}
        {isSeries && (
          <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
            <Button
              size="xs"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              disabled={!hasPrev}
              aria-label="Previous episode"
              className="text-xs py-1 px-2 h-7 sm:h-8"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onOpenEpisodes(); }}
              aria-label="Select episode"
              className="text-xs py-1 px-2 h-7 sm:h-8 whitespace-nowrap"
            >
              Episodes
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              disabled={!hasNext}
              aria-label="Next episode"
              className="text-xs py-1 px-2 h-7 sm:h-8"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
