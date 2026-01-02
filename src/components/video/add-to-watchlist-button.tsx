'use client';

import React from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useWatchlist } from '@/context/watchlist-context';
import type { Video } from '@/lib/data';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AddToWatchlistButtonProps extends ButtonProps {
  video: Video;
}

export function AddToWatchlistButton({ video, className, variant, size, ...props }: AddToWatchlistButtonProps) {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const isInWatchlist = !!watchlist[`${video.media_type}-${video.id}`];

  const handleToggleWatchlist = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWatchlist) {
      removeFromWatchlist(video.id, video.media_type);
    } else {
      addToWatchlist(video);
    }
  };
  
  const tooltipText = isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist';
  const Icon = isInWatchlist ? Check : Plus;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
           <Button
              variant={variant || "ghost"}
              size={size || "icon"}
              onClick={handleToggleWatchlist}
              className={cn("text-white hover:bg-white/20", { 'bg-primary/80 hover:bg-primary': isInWatchlist }, className)}
              aria-label={tooltipText}
              {...props}
            >
              <Icon className="h-5 w-5" />
           </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
