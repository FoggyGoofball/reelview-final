'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tmdbMediaToVideo } from '@/lib/api';
import { getTvSeasonDetails } from '@/lib/tmdb';
import type { Video, CustomVideoData } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlayCircle, Star, Pencil } from 'lucide-react';
import { getWatchHistory, getCustomVideoData } from '@/lib/client-api';
import { AddToWatchlistButton } from '@/components/video/add-to-watchlist-button';
import { EditEpisodesDialog } from '@/components/video/edit-episodes-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExpandableText } from '@/components/expandable-text';
import { getAnimeEpisodes, JikanEpisode } from '@/lib/jikan';
import { TMDBEpisode, TMDBMedia } from '@/lib/tmdb';
import { useSource } from '@/context/source-context';

function MediaDetailsSkeleton() {
  return (
    <div className="flex flex-col">
       <div className="h-[50vh] w-full bg-muted animate-pulse" />
       <div className="container max-w-screen-lg -mt-32 relative z-10">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            </div>
            <div className="w-full md:w-2/3 pt-16">
                <Skeleton className="h-12 w-3/4 mb-4" />
                <Skeleton className="h-6 w-1/4 mb-4" />
                <Skeleton className="h-20 w-full" />
                <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-32" />
                </div>
            </div>
          </div>
       </div>
    </div>
  )
}

function MediaDetailsPageContent() {
  const params = useParams();
  const navigate = useNavigate();

  const videoId = params.id as string;
  const mediaType = params.media_type as 'movie' | 'tv' | 'anime';
  
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<any>({});
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [animeEpisodeDetails, setAnimeEpisodeDetails] = useState<JikanEpisode[]>([]);
  const [tvSeasonDetails, setTvSeasonDetails] = useState<Record<number, TMDBEpisode[]>>({});

  const { source } = useSource();

  const applyCustomData = useCallback((videoData: Video, customData: Record<string, CustomVideoData>) => {
    const videoKey = `${videoData.media_type}-${videoData.id}`;
    const custom = customData[videoKey];
    if (!custom) return videoData;

    const updatedVideo = { ...videoData };
    if (updatedVideo.media_type === 'anime' && custom.episodes !== undefined) {
      updatedVideo.episodes = custom.episodes;
    }
    if (updatedVideo.media_type === 'tv' && custom.seasons !== undefined) {
       updatedVideo.seasons = custom.seasons;
    }
    return updatedVideo;
  }, []);

  const handleCustomDataSaved = useCallback((customData: CustomVideoData) => {
    if (!video) return;
    const allCustomData = getCustomVideoData();
    const updatedVideo = applyCustomData(video, {[video.id]: customData});
    setVideo(updatedVideo);
  }, [video, applyCustomData]);

  useEffect(() => {
    setHistory(getWatchHistory());
  }, []);

  const fetchFullDetails = useCallback(async (id: string, type: 'movie' | 'tv' | 'anime') => {
    setIsLoading(true);
    console.log(`[Media] Starting fetch for ID: ${id}, Type: ${type}`);

    try {
        const typeToFetch = type === 'anime' ? 'tv' : type;
        const initialMedia: TMDBMedia = {
            id: Number(id),
            media_type: typeToFetch,
            name: '', title: '', overview: '', poster_path: '', backdrop_path: '',
            genre_ids: [], release_date: '', first_air_date: '', vote_average: 0,
        };

        const enrichedVideo = await tmdbMediaToVideo(initialMedia);
        console.log('[Media] Enriched video from tmdbMediaToVideo:', enrichedVideo);

        if (!enrichedVideo) {
            console.error('[Media] ERROR: tmdbMediaToVideo returned null or undefined.');
            setVideo(null);
            setIsLoading(false);
            return;
        }
        
        enrichedVideo.media_type = type;

        const isSeries = enrichedVideo.media_type === 'tv' || enrichedVideo.media_type === 'anime';
        
        const customData = getCustomVideoData();
        let finalVideoData = applyCustomData(enrichedVideo, customData);
        console.log('[Media] Video data after applying custom data:', finalVideoData);

        const supplementalPromises = [];
        if (finalVideoData.media_type === 'anime' && finalVideoData.mal_id) {
            console.log(`[Media] Fetching Jikan episodes for MAL ID: ${finalVideoData.mal_id}`);
            supplementalPromises.push(getAnimeEpisodes(String(finalVideoData.mal_id)).then(setAnimeEpisodeDetails));
        }

        const seasonsToFetch = finalVideoData.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
        if (isSeries && seasonsToFetch.length > 0) {
             console.log(`[Media] Fetching TMDB season details for seasons:`, seasonsToFetch.map(s => s.season_number));
            const seasonDetailsPromises = seasonsToFetch.map(season =>
                getTvSeasonDetails(finalVideoData.id, season.season_number).then(details => (details?.episodes ? { [season.season_number]: details.episodes } : {}))
            );
            supplementalPromises.push(
                Promise.all(seasonDetailsPromises).then(results => {
                    const combinedDetails = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                    setTvSeasonDetails(combinedDetails);
                })
            );
        }

        await Promise.all(supplementalPromises);
        console.log('[Media] Successfully fetched all supplemental data.');
        setVideo(finalVideoData);

    } catch (error) {
        console.error("[Media] CRITICAL ERROR: Failed to fetch full video details", error);
        setVideo(null);
    } finally {
        setIsLoading(false);
         console.log('[Media] Fetch process finished.');
    }
  }, [applyCustomData]);

  useEffect(() => {
    if (!videoId || !mediaType) {
        setIsLoading(false);
        return;
    }
    console.log(`[Media] Component mounted. ID: ${videoId}, Type: ${mediaType}`);
    if (videoId && mediaType) {
      const hasApiKey = !!localStorage.getItem('TMDB_API_KEY');
      if (hasApiKey) {
        fetchFullDetails(videoId, mediaType);
      } else {
        console.warn('[Media] No TMDB API key found. Aborting fetch.');
        setIsLoading(false);
        setVideo(null);
      }
    }
  }, [videoId, mediaType, fetchFullDetails]);

  if (!videoId || !mediaType) {
    return (
      <div className="container max-w-screen-lg py-8 md:py-12 text-center">
        <h1 className="text-2xl font-bold">Content Not Found</h1>
        <p className="text-muted-foreground mt-2">Invalid media type or ID</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
          Return to Home
        </Button>
      </div>
    );
  }
  
  if (isLoading) {
    return <MediaDetailsSkeleton />;
  }

  if (!video) {
    return (
      <div className="container max-w-screen-lg py-8 md:py-12 text-center">
        <h1 className="text-2xl font-bold">Content Not Found</h1>
        <p className="text-muted-foreground mt-2">
            The movie or show you're looking for might have been removed or the ID is incorrect.
        </p>
         <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
           Return to Home
         </Button>
      </div>
    );
  }

  const heroImageUrl = video.thumbnailSeed ? (video.thumbnailSeed.startsWith('http') ? video.thumbnailSeed : `https://image.tmdb.org/t/p/w1280${video.thumbnailSeed}`) : "https://picsum.photos/seed/hero/1280/720";
  const posterImageUrl = video.poster_path ? (video.poster_path.startsWith('http') ? video.poster_path : `https://image.tmdb.org/t/p/w500${video.poster_path}`) : "https://picsum.photos/seed/poster/500/750";

  const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
  
  const episodeCount = isSeries && video.media_type === 'anime' ? video.episodes : 0;
  
  const getWatchHref = (season: number, episode: number) => {
    let href = `/watch?id=${video.id}&type=${video.media_type}&s=${season}&e=${episode}`;
    console.log(`[Media] Generated watch href: ${href}`);
    return href;
  }
  
  const firstPlayHref = isSeries
    ? getWatchHref(1, 1)
    : `/watch?id=${video.id}&type=${video.media_type}`;
  
  const historyKey = video.mal_id ? `mal-${video.mal_id}` : `tmdb-${video.id}`;
  const lastWatched = history[historyKey];

  const getContinueWatchingHref = () => {
    if (!lastWatched) return null;
    return getWatchHref(lastWatched.last_season_watched || 1, lastWatched.last_episode_watched || 1);
  }

  const continueWatchingHref = getContinueWatchingHref();
  console.log(`[Media] Continue watching href: ${continueWatchingHref}, First play href: ${firstPlayHref}`);

  const seasonsToDisplay = isSeries
    ? (video.media_type === 'anime' && episodeCount && episodeCount > 0 && (!video.seasons || video.seasons.length === 0))
      ? [{ season_number: 1, episode_count: episodeCount, name: 'Episodes' }]
      : video.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0).sort((a,b) => a.season_number - b.season_number) || []
    : [];

  return (
    <>
    <div className="flex flex-col">
      <div className="relative h-[40vh] md:h-[50vh] w-full">
        <img src={heroImageUrl} alt={`Promotional image for ${video.title}`} className="w-full h-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <div className="container max-w-screen-lg -mt-24 md:-mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3">
            <img src={posterImageUrl} alt={`Poster for ${video.title}`} className="w-full rounded-lg shadow-xl" style={{ aspectRatio: '2/3', objectFit: 'cover' }} />
          </div>
          <div className="w-full md:w-2/3 pt-8 md:pt-16">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground drop-shadow-xl">{video.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
               {video.release_date && <span>{video.release_date.substring(0, 4)}</span>}
               {video.vote_average && video.vote_average > 0 && <span>·</span>}
               {video.vote_average && video.vote_average > 0 && <div className='flex items-center gap-1'><Star className='h-4 w-4 text-yellow-400' /> {video.vote_average.toFixed(1)}</div>}
            </div>
            <ExpandableText text={video.description} className="mt-4 max-w-prose text-foreground/80 drop-shadow-lg" />

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={() => navigate(continueWatchingHref || firstPlayHref)}>
                <PlayCircle className="mr-2 h-6 w-6" /> {continueWatchingHref ? "Continue Watching" : "Play"}
              </Button>
              <AddToWatchlistButton video={video} variant="outline" size="lg" />
               {isSeries && (
                <Button variant="outline" size="lg" onClick={() => setIsEditDialogOpen(true)}>
                  <Pencil className="mr-2 h-5 w-5" /> Edit
                </Button>
               )}
            </div>
          </div>
        </div>
      </div>
      
      {isSeries && seasonsToDisplay.length > 0 && (
        <div className="container max-w-screen-lg py-12">
            <h2 className="text-2xl font-bold mb-4">Episodes</h2>
            <Accordion type="single" collapsible defaultValue="season-1" className="w-full">
              {seasonsToDisplay.map((season) => (
                <AccordionItem key={season.season_number} value={`season-${season.season_number}`}>
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                     {season.name || `Season ${season.season_number}`}
                  </AccordionTrigger>
                  <AccordionContent>
                      <div className="flex flex-col gap-4 pt-4">
                          {Array.from({ length: season.episode_count }).map((_, i) => {
                              const epNum = i + 1;
                              
                              // Safely calculate jikan episode index
                              let jikanEpisodeIndex = 0;
                              if (video.seasons && season.season_number > 1) {
                                const prevSeason = video.seasons.find(s => s.season_number === season.season_number - 1);
                                const prevSeasonEpisodes = prevSeason?.episode_count || 0;
                                jikanEpisodeIndex = (season.season_number - 1) * prevSeasonEpisodes + i;
                              } else {
                                jikanEpisodeIndex = i;
                              }
                              const jikanEpisodeDetail = animeEpisodeDetails[jikanEpisodeIndex];

                              const tmdbEpisodeDetail = tvSeasonDetails[season.season_number]?.find(e => e.episode_number === epNum);
                              
                              const watchHref = getWatchHref(season.season_number, epNum);

                              const title = tmdbEpisodeDetail?.name || jikanEpisodeDetail?.title || `Episode ${epNum}`;
                              const summary = tmdbEpisodeDetail?.overview || jikanEpisodeDetail?.synopsis || 'No summary available.';

                              // Check if episode has been watched - bulletproof
                              const seasonKey = String(season.season_number);
                              const episodeKey = String(epNum);
                              const seasonProgress = lastWatched?.show_progress?.[seasonKey];
                              const episodeWatched = (
                                !!seasonProgress &&
                                typeof seasonProgress === 'object' &&
                                seasonProgress !== null &&
                                Object.prototype.hasOwnProperty.call(seasonProgress, episodeKey)
                              );

                              return (
                                <div key={epNum} className="border-b border-border pb-4 last:border-b-0">
                                  <div className="flex items-start gap-4">
                                    <span className="text-2xl font-bold text-muted-foreground pt-1 min-w-[40px] text-center">{epNum}</span>
                                    <div className="flex-grow">
                                      <h3 className={`font-semibold ${episodeWatched ? 'text-green-500' : 'text-foreground'}`}>{title}</h3>
                                      <ExpandableText text={summary} charLimit={150} />
                                    </div>
                                    <div className="flex flex-col items-center justify-center shrink-0 w-24 gap-2">
                                      <Button size="sm" onClick={() => navigate(watchHref)} className="w-full">
                                          <PlayCircle className="h-5 w-5" /> Play
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )
                          })}
                      </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
        </div>
      )}

    </div>
    {isSeries && video && <EditEpisodesDialog video={video} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onDataSaved={handleCustomDataSaved} />}
    </>
  );
}

export default function MediaDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-black text-white">
          <Skeleton className="h-full w-full" />
        </div>
      }
    >
      <MediaDetailsPageContent />
    </Suspense>
  );
}
