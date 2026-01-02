import { useNavigate } from 'react-router-dom';
import { Star, Plus, X, Info, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDismissed } from '@/context/dismissed-context';
import { useWatchlist } from '@/context/watchlist-context';
import type { Video } from '@/lib/data';
import { cn } from '@/lib/utils';
import { updateWatchPositionOnNavigate } from '@/lib/client-api';

export interface VideoCardProps {
  video: Video;
  variant?: 'default' | 'compact';
  onDismiss?: (video: Video) => void;
  watchHref?: string; // optional override for primary click (used by continue-watching)
}

export function VideoCard({ video, variant = 'default', onDismiss, watchHref }: VideoCardProps) {
  const navigate = useNavigate();
  const { addToDismissed, isDismissed } = useDismissed();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
  const posterUrl = video.poster_path
    ? video.poster_path.startsWith('http')
      ? video.poster_path
      : `https://image.tmdb.org/t/p/w342${video.poster_path}`
    : 'https://picsum.photos/seed/default-poster/342/513';

  const isVideoInWatchlist = isInWatchlist(video.id, video.media_type);
  const isVideoDismissed = isDismissed(video.id, video.media_type);

  const detailHref = `/media/${video.media_type}/${video.id}`;
  const defaultWatchHref = isSeries ? `/watch?id=${video.id}&type=${video.media_type}&s=1&e=1` : `/watch?id=${video.id}&type=${video.media_type}`;
  const primaryHref = watchHref ? watchHref : detailHref; // prefer details unless watchHref provided

  const handleCardClick = () => {
    navigate(primaryHref);
  };

  const handleWatchNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = watchHref || defaultWatchHref;

    // Update watch history immediately so continue-watching carousels refresh
    updateWatchPositionOnNavigate(video.id, video.media_type, isSeries ? 1 : null, isSeries ? 1 : null, video.title);

    navigate(url);
  };

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(detailHref);
  };

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVideoInWatchlist) {
      removeFromWatchlist(video.id, video.media_type);
    } else {
      addToWatchlist(video);
    }
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToDismissed(video);
    if (onDismiss) {
      onDismiss(video);
    }
  };

  if (isVideoDismissed) {
    return null;
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden rounded-lg bg-muted cursor-pointer transition-all hover:shadow-xl hover:scale-105',
        variant === 'compact' && 'w-24'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0 relative h-full">
        <img
          src={posterUrl}
          alt={`Poster for ${video.title}`}
          className="w-full h-full object-cover"
          style={{ aspectRatio: '2/3' }}
        />

        {/* Overlay: always visible on mobile, on hover for desktop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10" />

        {/* Right-justified vertical icon-only action buttons (smaller) */}
        <div className={cn(
          "absolute inset-y-0 right-3 flex flex-col items-end justify-center gap-2 z-20",
          "md:opacity-0 md:pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
        )}>
          <button onClick={handleWatchNow} title="Watch Now" className="bg-black/70 hover:bg-red-600/80 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center shadow transition-colors">
            <Play className="h-4 w-4" />
          </button>
          <button onClick={handleDetails} title="Details" className="bg-black/70 hover:bg-blue-500/80 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center shadow transition-colors">
            <Info className="h-4 w-4" />
          </button>
          <button onClick={handleWatchlistClick} title={isVideoInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'} className={cn(
            'bg-black/70 rounded-full p-2 h-8 w-8 flex items-center justify-center shadow transition-colors',
            isVideoInWatchlist ? 'hover:bg-green-600/80 text-green-400' : 'hover:bg-green-500/80 text-white'
          )}>
            {isVideoInWatchlist ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
          <button onClick={handleDismissClick} title="Dismiss" className="bg-black/70 hover:bg-red-500/80 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center shadow transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Age rating badge (use video.rating if available) */}
        {video.rating && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/80 rounded px-2 py-1 z-30">
            <span className="text-xs font-semibold text-white">
              {video.rating}
            </span>
          </div>
        )}

        {/* Dismiss button (quick dismiss via X) - always visible on mobile, on hover for desktop */}
        <button
          onClick={handleDismissClick}
          className="absolute top-2 left-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-30"
          aria-label="Dismiss"
          title="Dismiss this item"
        >
          <X className="h-6 w-6 text-white bg-black/50 rounded-full p-1 hover:bg-black/75" />
        </button>
      </CardContent>
    </Card>
  );
}
