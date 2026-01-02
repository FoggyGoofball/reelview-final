'use client';
import { useState, useEffect, useCallback, memo } from 'react';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video, Category } from '@/lib/data';
import { VideoCarousel } from '@/components/video/video-carousel';
import { Clapperboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDismissed } from '@/context/dismissed-context';
import { TMDBMedia } from '@/lib/tmdb';

const ANIME_GENRES: Category[] = [
    { id: '10759', name: 'Action & Adventure' },
    { id: '18', name: 'Drama' },
    { id: '10765', name: 'Sci-Fi & Fantasy' },
    { id: '210024', name: 'Shonen', is_keyword: true },
    { id: '35', name: 'Comedy' },
];

const CAROUSEL_ITEM_LIMIT = 7;
const CAROUSEL_FETCH_LIMIT = 8; // Fetch one more to check for "hasMore"

type VideosByGenre = Record<string, Video[]>;
type LoadingByGenre = Record<string, boolean>;

const MemoizedVideoCarousel = memo(VideoCarousel);

const fetchGenre = async (
    genre: Category,
    dismissedItems: Record<string, Video>,
    masterProcessedIds: Set<string>,
    toast: (options: any) => void
): Promise<{ genreId: string, videos: Video[] }> => {
    const currentVideosForGenre: Video[] = [];
    let page = 1;
    try {
      while (currentVideosForGenre.length < CAROUSEL_FETCH_LIMIT && page <= 5) {
        const rawMedia: TMDBMedia[] = await getVideosByGenre(genre.id, 'anime', !!genre.is_keyword, page);
        if (!rawMedia || rawMedia.length === 0) break;

        for (const basicVideo of rawMedia) {
          if (currentVideosForGenre.length >= CAROUSEL_FETCH_LIMIT) break;

          const videoKey = `tv-${basicVideo.id}`;
          if (dismissedItems[videoKey] || masterProcessedIds.has(videoKey)) {
            continue;
          }

          const enrichedVideo = await tmdbMediaToVideo(basicVideo);
          if (enrichedVideo && enrichedVideo.media_type === 'anime' && !enrichedVideo.is_explicit) {
              masterProcessedIds.add(videoKey);
              currentVideosForGenre.push(enrichedVideo);
          }
        }
        page++;
      }
    } catch (error) {
      console.error(`Failed to fetch videos for genre ${genre.name}:`, error);
      toast({ variant: "destructive", title: `Failed to fetch videos`, description: `Could not load ${genre.name} videos.` });
    }
    return { genreId: genre.id, videos: currentVideosForGenre };
}

export default function AnimeGenresPage() {
  const [videosByGenre, setVideosByGenre] = useState<VideosByGenre>({});
  const [loadingByGenre, setLoadingByGenre] = useState<LoadingByGenre>({});
  const { toast } = useToast();
  const { dismissedItems } = useDismissed();

  const fetchAllGenres = useCallback(async () => {
    setLoadingByGenre({});
    const initialLoading: LoadingByGenre = {};
    ANIME_GENRES.forEach(genre => {
        initialLoading[genre.id] = true;
    });
    setLoadingByGenre(initialLoading);
    setVideosByGenre({});

    const masterProcessedIds = new Set<string>();

    // Sequential fetching to ensure deduplication across carousels
    for (const genre of ANIME_GENRES) {
      setLoadingByGenre(prev => ({ ...prev, [genre.id]: true }));
      try {
        const result = await fetchGenre(genre, dismissedItems, masterProcessedIds, toast);
        setVideosByGenre(prev => ({ ...prev, [result.genreId]: result.videos }));
      } catch (error) {
        console.error('[ANIME] Error fetching genre', genre.id, error);
        setVideosByGenre(prev => ({ ...prev, [genre.id]: [] }));
      } finally {
        setLoadingByGenre(prev => ({ ...prev, [genre.id]: false }));
      }
    }

  }, [dismissedItems, toast]);

  useEffect(() => {
    fetchAllGenres();
  }, [fetchAllGenres]);

  const handleDismiss = useCallback((video: Video) => {
    setVideosByGenre(prev => {
      const newState = { ...prev };
      for (const genreId in newState) {
        newState[genreId] = newState[genreId].filter(v => v.id !== video.id || v.media_type !== video.media_type);
      }
      return newState;
    });
  }, []);

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Clapperboard className="h-8 w-8 text-primary" />
          Anime by Genre
        </h1>
      </div>
      <div className="flex flex-col gap-8 md:gap-12 lg:gap-16">
        {ANIME_GENRES.map(genre => {
            const allVideosForGenre = videosByGenre[genre.id] || [];
            const carouselVideos = allVideosForGenre.slice(0, CAROUSEL_ITEM_LIMIT);
            const hasMore = allVideosForGenre.length > CAROUSEL_ITEM_LIMIT;
            const isLoading = loadingByGenre[genre.id] !== false;
            const href = `/anime/genre?id=${genre.id}&name=${encodeURIComponent(genre.name)}${genre.is_keyword ? '&is_keyword=1' : ''}`;
            return (
                <MemoizedVideoCarousel 
                    key={genre.id}
                    category={genre} 
                    videos={carouselVideos}
                    isLoading={isLoading && carouselVideos.length === 0}
                    onDismiss={handleDismiss}
                    hasMore={hasMore}
                    href={href}
                />
            );
        })}
      </div>
    </div>
  );
}
