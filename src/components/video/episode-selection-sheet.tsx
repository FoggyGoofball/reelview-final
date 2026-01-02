'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { Video } from "@/lib/data";
import { cn } from "@/lib/utils";
import { PlayCircle } from "lucide-react";
import { ExpandableText } from "../expandable-text";
import type { TMDBEpisode } from "@/lib/tmdb";
import type { JikanEpisode } from "@/lib/jikan";
import { getWatchHistory } from "@/lib/client-api";

interface EpisodeSelectionSheetProps {
  video: Video;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentSeason: number;
  currentEpisode: number;
  onEpisodeSelect: (season: number, episode: number) => void;
  tvSeasonDetails: Record<number, TMDBEpisode[]>;
  animeEpisodeDetails: JikanEpisode[];
}

export function EpisodeSelectionSheet({
  video,
  isOpen,
  onOpenChange,
  currentSeason,
  currentEpisode,
  onEpisodeSelect,
  tvSeasonDetails,
  animeEpisodeDetails,
}: EpisodeSelectionSheetProps) {

  const handleEpisodeClick = (season: number, episode: number) => {
    onEpisodeSelect(season, episode);
    onOpenChange(false);
  }

  const isAnime = video.media_type === 'anime';
  const history = getWatchHistory();
  const historyKey = video.mal_id ? `mal-${video.mal_id}` : `tmdb-${video.id}`;
  const watchedEpisodes = history[historyKey]?.show_progress || {};

  const seasonsToDisplay = isAnime && video.episodes && (!video.seasons || video.seasons.length === 0)
    ? [{ season_number: 1, episode_count: video.episodes, name: 'Episodes' }]
    : video.seasons?.filter(s => s.season_number > 0).sort((a,b) => a.season_number - b.season_number) || [];

  const isEpisodeWatched = (season: number, episode: number): boolean => {
    const seasonKey = String(season);
    const episodeKey = String(episode);
    return seasonKey in watchedEpisodes && episodeKey in watchedEpisodes[seasonKey];
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{video.title}</SheetTitle>
          <SheetDescription>Select an episode to watch.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-6">
            <Accordion
              type="single"
              collapsible
              className="w-full"
              defaultValue={`season-${currentSeason}`}
            >
              {seasonsToDisplay.map((season) => (
                <AccordionItem
                  key={season.season_number}
                  value={`season-${season.season_number}`}
                >
                  <AccordionTrigger className="text-lg font-semibold">
                    {season.name || `Season ${season.season_number}`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: season.episode_count }).map((_, i) => {
                        const epNum = i + 1;
                        const isPlaying =
                          season.season_number === currentSeason &&
                          epNum === currentEpisode;
                        const watched = isEpisodeWatched(season.season_number, epNum);

                        const jikanEpisodeIndex = (season.season_number - 1) * (video.seasons?.find(s=>s.season_number === season.season_number-1)?.episode_count || 0) + i;
                        const jikanEpisodeDetail = animeEpisodeDetails[jikanEpisodeIndex];

                        const tmdbEpisodeDetail = tvSeasonDetails[season.season_number]?.find(e => e.episode_number === epNum);
                        
                        const title = tmdbEpisodeDetail?.name || jikanEpisodeDetail?.title || `Episode ${epNum}`;
                        const summary = tmdbEpisodeDetail?.overview || jikanEpisodeDetail?.synopsis || 'No summary available.';

                        return (
                          <div
                            key={epNum}
                            className={cn(
                              "w-full justify-start text-left h-auto py-3 px-4 rounded-md flex items-center gap-4",
                              isPlaying ? "bg-primary/20 text-primary-foreground" : "bg-secondary/50"
                            )}
                          >
                            <span className="text-lg font-mono text-muted-foreground w-8 text-center">
                              {epNum}
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className={cn("font-semibold", watched && "text-green-500")}>{title}</p>
                              <ExpandableText text={summary} charLimit={100} className="text-xs text-muted-foreground" />
                            </div>
                            <Button
                              variant={isPlaying ? "default" : "ghost"}
                              size="icon"
                              onClick={() => handleEpisodeClick(season.season_number, epNum)}
                              className="ml-auto shrink-0"
                            >
                              <PlayCircle className="h-5 w-5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
