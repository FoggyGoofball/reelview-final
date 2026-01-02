'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Video, CustomVideoData } from '@/lib/data';
import { getAnimeEpisodes, type JikanEpisode } from '@/lib/jikan';
import { getTvSeasonDetails, type TMDBEpisode, type TMDBMedia } from '@/lib/tmdb';
import { tmdbMediaToVideo } from '@/lib/api';
import { getCustomVideoData, updateWatchPositionOnNavigate } from '@/lib/client-api';
import { Skeleton } from '@/components/ui/skeleton';
import { VidlinkPlayer } from '@/components/video/vidlink-player';
import { WatchHeader } from '@/components/video/watch-header';
import { EpisodeSelectionSheet } from '@/components/video/episode-selection-sheet';
import { useSource } from '@/context/source-context';

function WatchPageContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Parse query params from React Router location
  const params = new URLSearchParams(location.search);
  const tmdbId = params.get('id');
  const mediaType = params.get('type') as 'movie' | 'tv' | 'anime' | null;
  const initialSeason = params.get('s') ? parseInt(params.get('s') as string, 10) : undefined;
  const initialEpisode = params.get('e') ? parseInt(params.get('e') as string, 10) : undefined;

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState(initialSeason || 1);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode || 1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [animeEpisodeDetails, setAnimeEpisodeDetails] = useState<JikanEpisode[]>([]);
  const [tvSeasonDetails, setTvSeasonDetails] = useState<Record<number, TMDBEpisode[]>>({});
  const { source } = useSource();

  useEffect(() => {
    if (mediaType && mediaType !== 'movie' && (!initialSeason || !initialEpisode)) {
      navigate(`/watch?id=${tmdbId}&type=${mediaType}&s=1&e=1`);
    }
  }, [mediaType, initialSeason, initialEpisode, tmdbId, navigate]);

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

  useEffect(() => {
    if (!tmdbId || !mediaType) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const typeToFetch = mediaType === 'anime' ? 'tv' : mediaType;
        const initialMedia: TMDBMedia = {
            id: Number(tmdbId),
            media_type: typeToFetch,
            name: '', title: '', overview: '', poster_path: '', backdrop_path: '',
            genre_ids: [], release_date: '', first_air_date: '', vote_average: 0,
        };

        let enrichedVideo = await tmdbMediaToVideo(initialMedia);
        if (!enrichedVideo) {
          setVideo(null);
          setIsLoading(false);
          return;
        }
        
        if (mediaType === 'anime') {
            enrichedVideo.media_type = 'anime';
        }

        const customData = getCustomVideoData();
        enrichedVideo = applyCustomData(enrichedVideo, customData);
        setVideo(enrichedVideo);

        // Fetch supplemental episode/season data
        const supplementalPromises = [];
        if (enrichedVideo.media_type === 'anime' && enrichedVideo.mal_id) {
            supplementalPromises.push(getAnimeEpisodes(String(enrichedVideo.mal_id)).then(setAnimeEpisodeDetails));
        }
        const isSeries = enrichedVideo.media_type === 'tv' || enrichedVideo.media_type === 'anime';
        const seasonsToFetch = enrichedVideo.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
        if (isSeries && seasonsToFetch.length > 0) {
            const seasonDetailsPromises = seasonsToFetch.map(season =>
                getTvSeasonDetails(enrichedVideo!.id, season.season_number).then(details => (details?.episodes ? { [season.season_number]: details.episodes } : {}))
            );
            supplementalPromises.push(
                Promise.all(seasonDetailsPromises).then(results => {
                    const combinedDetails = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                    setTvSeasonDetails(combinedDetails);
                })
            );
        }

        await Promise.all(supplementalPromises);

      } catch (error) {
        console.error('Failed to fetch video data', error);
        setVideo(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [tmdbId, mediaType, applyCustomData]);

  const playerUrl = useMemo(() => {
    if (!video) return '';

    const s = currentSeason || 1;
    const e = currentEpisode || 1;
    
    const defaultUrl = video.media_type === 'movie'
      ? `https://vidlink.pro/movie/${video.id}?autoplay=true`
      : `https://vidlink.pro/tv/${video.id}/${s}/${e}?autoplay=true`;

    let url = '';
    
    switch (source) {
      case 'vidsrc':
        url = video.media_type === 'movie'
          ? `https://vidsrc.net/embed/movie?tmdb=${video.id}`
          : `https://vidsrc.net/embed/tv?tmdb=${video.id}&season=${s}&episode=${e}`;
        break;
      case 'godrive':
        if (video.media_type === 'movie') {
          url = `https://godriveplayer.com/player.php?type=movie&tmdb=${video.id}`;
        } else {
          url = `https://godriveplayer.com/player.php?type=series&tmdb=${video.id}&season=${s}&episode=${e}`;
        }
        break;
      case 'mostream':
        if (video.media_type === 'movie') {
          url = `https://mostream.us/embed.php?tmdb=${video.id}`;
        } else {
          url = `https://mostream.us/embed.php?tmdb=${video.id}&s=${s}&e=${e}`;
        }
        break;
      case 'default':
      default:
        url = defaultUrl;
        break;
    }
    
    const finalUrl = url || defaultUrl;
    console.log(`[VidlinkPlayer] Generated player URL for "${video.title}" (Source: ${source}): ${finalUrl}`);
    return finalUrl;
  }, [video, currentSeason, currentEpisode, source]);


  const seasonsToDisplay = useMemo(() => {
    if (!video) return [];
    const isAnime = video.media_type === 'anime';
    if (isAnime && video.episodes && (!video.seasons || video.seasons.length === 0)) {
        return [{ season_number: 1, episode_count: video.episodes, name: 'Episodes' }];
    }
    return video.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0).sort((a, b) => a.season_number - b.season_number) || [];
  }, [video]);
  
  const handleEpisodeSelect = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);

    // update history immediately so continue-watching reflects this navigation
    updateWatchPositionOnNavigate(String(tmdbId || ''), mediaType as any, season, episode, video?.title || '');
    
    const newUrl = `/watch?id=${tmdbId}&type=${mediaType}&s=${season}&e=${episode}`;
    navigate(newUrl);
  };
  
  const handleNext = () => {
    if (!video || isLoading) return;
    
    const currentSeasonData = seasonsToDisplay.find(s => s.season_number === currentSeason);
    if (!currentSeasonData) return;

    if (currentEpisode < currentSeasonData.episode_count) {
      handleEpisodeSelect(currentSeason, currentEpisode + 1);
    } else {
        const currentSeasonIndex = seasonsToDisplay.findIndex(s => s.season_number === currentSeason);
        if (currentSeasonIndex < seasonsToDisplay.length - 1) {
            const nextSeason = seasonsToDisplay[currentSeasonIndex + 1];
            if(nextSeason) {
                handleEpisodeSelect(nextSeason.season_number, 1);
            }
        }
    }
  };

  const handlePrev = () => {
    if (!video || isLoading) return;
    if (currentEpisode > 1) {
      handleEpisodeSelect(currentSeason, currentEpisode - 1);
    } else {
      const currentSeasonIndex = seasonsToDisplay.findIndex(s => s.season_number === currentSeason);
       if (currentSeasonIndex > 0) {
          const prevSeason = seasonsToDisplay[currentSeasonIndex - 1];
          if(prevSeason) {
            handleEpisodeSelect(prevSeason.season_number, prevSeason.episode_count);
          }
      }
    }
  };

  const hasPrev = useMemo(() => {
      if (!seasonsToDisplay || seasonsToDisplay.length === 0) return false;
      const firstSeason = seasonsToDisplay[0];
      if (!firstSeason) return false;
      return currentSeason > firstSeason.season_number || currentEpisode > 1;
  }, [currentEpisode, currentSeason, seasonsToDisplay]);

  const hasNext = useMemo(() => {
    if (!seasonsToDisplay || seasonsToDisplay.length === 0) return false;
    const currentSeasonData = seasonsToDisplay.find(s => s.season_number === currentSeason);
    if (!currentSeasonData) return false;

    if (currentEpisode < currentSeasonData.episode_count) {
        return true;
    }
    
    const currentSeasonIndex = seasonsToDisplay.findIndex(s => s.season_number === currentSeason);
    return currentSeasonIndex < seasonsToDisplay.length - 1;
  }, [currentEpisode, currentSeason, seasonsToDisplay]);

  if (!tmdbId || !mediaType) {
    return <div className="h-screen w-screen bg-black flex justify-center items-center"><div>Content not found</div></div>;
  }

  if (isLoading) {
    return <div className="h-screen w-screen bg-black flex justify-center items-center"><Skeleton className="h-full w-full" /></div>;
  }
  
  if (!video) {
    return <div className="h-screen w-screen bg-black flex justify-center items-center"><div>Video not found</div></div>;
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      <div className="relative h-full w-full flex flex-col">
        <WatchHeader 
            video={video}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            onNext={handleNext}
            onPrev={handlePrev}
            onOpenEpisodes={() => setIsSheetOpen(true)}
            hasNext={hasNext}
            hasPrev={hasPrev}
            playerUrl={playerUrl}
        />
        <div className="flex-1 relative w-full">
          <VidlinkPlayer 
              video={video}
              playerUrl={playerUrl}
              season={currentSeason}
              episode={currentEpisode}
          />
        </div>
      </div>
      
      {mediaType !== 'movie' && (
        <EpisodeSelectionSheet
          video={video}
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          onEpisodeSelect={handleEpisodeSelect}
          tvSeasonDetails={tvSeasonDetails}
          animeEpisodeDetails={animeEpisodeDetails}
        />
      )}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black flex justify-center items-center"><Skeleton className="h-full w-full" /></div>}>
      <WatchPageContent />
    </Suspense>
  )
}
