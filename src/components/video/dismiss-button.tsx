'use client';

import React, { useState } from 'react';
import { ThumbsDown } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import type { Video } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useWatchlist } from '@/context/watchlist-context';
import { getWatchHistory, removeFromHistory } from '@/lib/client-api';
import { useDismissed } from '@/context/dismissed-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DismissButtonProps extends ButtonProps {
  video: Video;
  onDismiss?: (video: Video) => void;
}

export function DismissButton({ video, className, variant, size, onDismiss, ...props }: DismissButtonProps) {
  const { removeFromWatchlist, watchlist } = useWatchlist();
  const { dismissItem, dismissedItems } = useDismissed();
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const isInWatchlist = !!watchlist[`${video.media_type}-${video.id}`];
  const historyKey = video.media_type === 'anime' ? `mal-${video.mal_id || video.id}` : `tmdb-${video.id}`;
  const isInHistory = !!getWatchHistory()[historyKey];
  const isDismissed = !!dismissedItems[`${video.media_type}-${video.id}`];

  const handleDismissClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDismissed) return;

    if (isInWatchlist || isInHistory) {
      setIsAlertOpen(true);
    } else {
      dismissItem(video);
      onDismiss?.(video);
    }
  };

  const handleConfirm = () => {
    if (isInWatchlist) {
      removeFromWatchlist(video.id, video.media_type);
    }
    if (isInHistory) {
      removeFromHistory(video.id, video.media_type, video.mal_id);
    }
    dismissItem(video);
    onDismiss?.(video);
    setIsAlertOpen(false);
  };
  
  const tooltipText = isDismissed ? 'Already dismissed' : 'Not interested';

  return (
    <>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
           <Button
              variant={variant || "ghost"}
              size={size || "icon"}
              onClick={handleDismissClick}
              disabled={isDismissed}
              className={cn("text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed", className)}
              aria-label={tooltipText}
              {...props}
            >
              <ThumbsDown className="h-5 w-5" />
           </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

     <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This title is in your {isInWatchlist ? 'Watchlist' : ''}{isInWatchlist && isInHistory ? ' and ' : ''}{isInHistory ? 'History' : ''}. 
              Dismissing it will also remove it from these lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirm & Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
