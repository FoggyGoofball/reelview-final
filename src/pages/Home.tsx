'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideos, getPopularTvShows, getLatestAnime, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { VideoCarousel } from '@/components/video/video-carousel';
import { PlayCircle } from 'lucide-react';
import { ApiKeyNotice } from '@/components/api-key-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { ContinueWatchingCarousel } from '@/components/video/continue-watching-carousel';
import { WatchlistCarousel } from '@/components/video/watchlist-carousel';
import { useDismissed } from '@/context/dismissed-context';
import { TMDBMovie, TMDBTvShow } from '@/lib/tmdb';
import { cn } from '@/lib/utils';

console.log('[HOME] Home page loading...')

export default function Home() {
  console.log('[HOME] Rendering Home component')

  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [popularMovies, setPopularMovies] = useState<Video[]>([]);
  const [popularSeries, setPopularSeries] = useState<Video[]>([]);
  const [topAnime, setTopAnime] = useState<Video[]>([]);
  
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [isLoadingSeries, setIsLoadingSeries] = useState(true);
  const [isLoadingAnime, setIsLoadingAnime] = useState(true);

  const [featuredVideo, setFeaturedVideo] = useState<Video | null>(null);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [featuredPool, setFeaturedPool] = useState<Video[]>([]);

  const { dismissedItems } = useDismissed();

  useEffect(() => {
    console.log('[HOME] Mounting, checking API key...')
    setIsMounted(true);
    const key = localStorage.getItem('TMDB_API_KEY');
    setApiKey(key);
  }, []);

  const processMediaList = useCallback(async <T extends TMDBMovie | TMDBTvShow>(
    fetcher: () => Promise<T[] | null>,
    isAnime: boolean = false
  ): Promise<Video[]> => {
    try {
      const rawItems = await fetcher();
      if (!rawItems || rawItems.length === 0) {
        return [];
      }
      
      const enrichedItems = await Promise.all(
        rawItems.map(item => tmdbMediaToVideo(item))
      );

      const validItems = enrichedItems.filter((video): video is Video => !!video);
      
      return isAnime 
        ? validItems.filter(video => !video.is_explicit)
        : validItems;

    } catch (error) {
      console.error("[HOME] Failed to process media list", error);
      return [];
    }
  }, []);


  useEffect(() => {
    console.log('[HOME] Data fetch effect, apiKey:', !!apiKey, 'mounted:', isMounted)
    
    if (!apiKey || !isMounted) {
      if(isMounted) {
        setIsLoadingMovies(false);
        setIsLoadingSeries(false);
        setIsLoadingAnime(false);
        setIsFeaturedLoading(false);
      }
      return;
    }
    
    const fetchAllData = async () => {
        console.log('[HOME] Fetching all data...')
        setIsLoadingMovies(true);
        setIsLoadingSeries(true);
        setIsLoadingAnime(true);
        setIsFeaturedLoading(true);

        // Sequential loading: fetch each list one by one so each carousel can render as soon as it's ready
        try {
          const movies = await processMediaList(getVideos, false);
          setPopularMovies(movies);
          setIsLoadingMovies(false);

          // update featured pool incrementally
          const partialPool1 = [...movies.slice(0,3)];
          setFeaturedPool(prev => {
            const pool = [...partialPool1, ...(prev || [])].filter(Boolean);
            return pool;
          });
          if (!featuredVideo && movies.length > 0) setFeaturedVideo(movies[0]);

          const series = await processMediaList(getPopularTvShows, false);
          setPopularSeries(series);
          setIsLoadingSeries(false);

          setFeaturedPool(prev => {
            const pool = [...(prev || []), ...series.slice(0,3)].filter(Boolean);
            // dedupe by id
            const seen = new Set();
            return pool.filter(v => { const k = `${v.media_type}-${v.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
          });
          if (!featuredVideo && series.length > 0) setFeaturedVideo(series[0]);

          const anime = await processMediaList(getLatestAnime, true);
          setTopAnime(anime);
          setIsLoadingAnime(false);

          setFeaturedPool(prev => {
            const pool = [...(prev || []), ...anime.slice(0,3)].filter(Boolean);
            const seen = new Set();
            return pool.filter(v => { const k = `${v.media_type}-${v.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
          });
          if (!featuredVideo && anime.length > 0) setFeaturedVideo(anime[0]);

        } catch (error) {
          console.error('[HOME] Error fetching lists sequentially', error);
        } finally {
          setIsFeaturedLoading(false);
          setIsLoadingMovies(false);
          setIsLoadingSeries(false);
          setIsLoadingAnime(false);
        }
    };

    fetchAllData();

  }, [apiKey, isMounted, processMediaList]);
  
  useEffect(() => {
    if (featuredPool.length <= 1) return;

    const intervalId = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setFeaturedVideo(current => {
          if (!current) return featuredPool[0];
          const validPool = featuredPool.filter(v => !dismissedItems[`${v.media_type}-${v.id}`]);
          if (validPool.length === 0) return null;
          
          const currentIndex = validPool.findIndex(v => v.id === current.id);
          const nextIndex = (currentIndex + 1) % validPool.length;
          return validPool[nextIndex];
        });
        setIsTransitioning(false);
      }, 1000);

    }, 18000);

    return () => clearInterval(intervalId);
  }, [featuredPool, dismissedItems]);

  if (!isMounted) {
    return (
       <div className="flex flex-col">
        <Skeleton className="h-[60vh] w-full" />
        <div className="container max-w-screen-2xl flex flex-col gap-8 md:gap-12 lg:gap-16 py-8 md:py-12">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyNotice />;
  }

  const filterDismissed = (videos: Video[]) => {
    return videos.filter(video => 
        !dismissedItems[`${video.media_type}-${video.id}`]
    );
  }

  const handleDismiss = (video: Video) => {
    switch (video.media_type) {
      case 'movie':
        setPopularMovies(prev => prev.filter(m => m.id !== video.id));
        break;
      case 'tv':
        setPopularSeries(prev => prev.filter(s => s.id !== video.id));
        break;
      case 'anime':
        setTopAnime(prev => prev.filter(a => a.id !== video.id));
        break;
    }
  }
    
  const currentFeaturedVideo = featuredVideo && !dismissedItems[`${featuredVideo.media_type}-${featuredVideo.id}`]
    ? featuredVideo
    : featuredPool.find(v => !dismissedItems[`${v.media_type}-${v.id}`]) || null;


  const getPlayHref = (video: Video) => {
    const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
    return isSeries
      ? `/watch?id=${video.id}&type=${video.media_type}&s=1&e=1`
      : `/watch?id=${video.id}&type=${video.media_type}`;
  }

  return (
    <div className="flex flex-col">
      {isFeaturedLoading ? (
         <Skeleton className="h-[60vh] w-full" />
      ) : currentFeaturedVideo && (
        <div className="relative h-[60vh] w-full overflow-hidden">
          <img
            key={currentFeaturedVideo.id}
            src={`https://image.tmdb.org/t/p/w1280${currentFeaturedVideo.thumbnailSeed}`}
            alt={`Promotional image for ${currentFeaturedVideo.title}`}
            className={cn("w-full h-full object-cover transition-opacity duration-500", isTransitioning ? 'opacity-0' : 'opacity-100')}
            style={{ aspectRatio: '16/9' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 md:p-12 lg:p-16 w-full md:w-2/3 lg:w-1/2">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground drop-shadow-xl">
              {currentFeaturedVideo.title}
            </h1>
            {!currentFeaturedVideo.description ? (
                <Skeleton className='h-20 w-full mt-4' />
            ) : (
                <p className="mt-4 max-w-prose text-sm text-foreground/80 drop-shadow-lg line-clamp-3">
                  {currentFeaturedVideo.description}
                </p>
            )}
            <div className="mt-6">
              <Button size="lg" onClick={() => navigate(getPlayHref(currentFeaturedVideo))}>
                <PlayCircle className="mr-2 h-6 w-6" /> Play
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="container max-w-screen-2xl flex flex-col gap-8 md:gap-12 lg:gap-16 py-8 md:py-12">
        <ContinueWatchingCarousel />
        <WatchlistCarousel />
        <VideoCarousel 
            category={{ id: 'popular-movies', name: 'Popular Movies' }}
            videos={filterDismissed(popularMovies)}
            isLoading={isLoadingMovies && popularMovies.length === 0}
            onDismiss={handleDismiss}
            href="/movies"
            hasMore={popularMovies.length >= 10}
        />
        <VideoCarousel 
            category={{ id: 'popular-series', name: 'Popular TV Series' }}
            videos={filterDismissed(popularSeries)}
            isLoading={isLoadingSeries && popularSeries.length === 0}
            onDismiss={handleDismiss}
            href="/tv"
            hasMore={popularSeries.length >= 10}
        />
        <VideoCarousel 
            category={{ id: 'top-anime', name: 'Top Airing Anime' }}
            videos={filterDismissed(topAnime)}
            isLoading={isLoadingAnime && topAnime.length === 0}
            onDismiss={handleDismiss}
            href="/anime"
            hasMore={topAnime.length >= 10}
        />
      </div>
    </div>
  );
}
