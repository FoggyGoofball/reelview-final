'use client';
import { useState, useEffect, useCallback, memo } from 'react';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video, Category } from '@/lib/data';
import { VideoCarousel } from '@/components/video/video-carousel';
import { Clapperboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDismissed } from '@/context/dismissed-context';
import { TMDBMedia } from '@/lib/tmdb';

const MOVIE_GENRES: Category[] = [
    { id: '28', name: 'Action' },
    { id: '35', name: 'Comedy' },
    { id: '18', name: 'Drama' },
    { id: '27', name: 'Horror' },
    { id: '878', name: 'Science Fiction' },
    { id: '53', name: 'Thriller' },
];

const CAROUSEL_ITEM_LIMIT = 7;
const CAROUSEL_FETCH_LIMIT = 8; // Fetch one more to check for "hasMore"

type VideosByGenre = Record<string, Video[]>;
type LoadingByGenre = Record<string, boolean>;

const MemoizedVideoCarousel = memo(VideoCarousel);

const fetchGenre = async (
  genre: Category,
  dismissedItems: Record<string, Video>,
  allProcessedIds: Set<string>,
  toast: (options: any) => void
): Promise<{ genreId: string; videos: Video[] }> => {
    try {
        let page = 1;
        let processedVideos: Video[] = [];

        while (processedVideos.length < CAROUSEL_FETCH_LIMIT && page <= 5) {
            const rawMedia: TMDBMedia[] = await getVideosByGenre(genre.id, 'movie', false, page);
            if (!rawMedia || rawMedia.length === 0) break;

            for (const basicVideo of rawMedia) {
                if (processedVideos.length >= CAROUSEL_FETCH_LIMIT) break;

                const videoKey = `movie-${basicVideo.id}`;
                if (dismissedItems[videoKey] || allProcessedIds.has(videoKey)) continue;

                const enrichedVideo = await tmdbMediaToVideo(basicVideo);
                if (enrichedVideo) {
                    allProcessedIds.add(videoKey);
                    processedVideos.push(enrichedVideo);
                }
            }
            page++;
        }
        return { genreId: genre.id, videos: processedVideos };

    } catch (error: any) {
        console.error(`[Fetch] ERROR: Failed to fetch movies for genre "${genre.name}". Reason: ${error.message}`);
        toast({ variant: "destructive", title: `Failed to fetch movies`, description: `Could not load ${genre.name} movies.` });
        return { genreId: genre.id, videos: [] };
    }
};

export default function MovieGenresPage() {
  const [videosByGenre, setVideosByGenre] = useState<VideosByGenre>({});
  const [loadingByGenre, setLoadingByGenre] = useState<LoadingByGenre>({});
  const { toast } = useToast();
  const { dismissedItems } = useDismissed();

  const handleDismiss = useCallback((video: Video) => {
    setVideosByGenre(prev => {
        const newState = {...prev};
        for (const genreId in newState) {
            newState[genreId] = newState[genreId].filter(v => v.id !== video.id || v.media_type !== video.media_type);
        }
        return newState;
    });
  }, []);

  const fetchAllGenres = useCallback(async () => {
    setLoadingByGenre(prev => {
        const newLoadingState: LoadingByGenre = {};
        MOVIE_GENRES.forEach(g => newLoadingState[g.id] = true);
        return newLoadingState;
    });

    const allProcessedIds = new Set<string>();
    
    const genrePromises = MOVIE_GENRES.map(genre => fetchGenre(genre, dismissedItems, allProcessedIds, toast));
    const genreResults = await Promise.all(genrePromises);

    const newVideosByGenre: VideosByGenre = {};
    genreResults.forEach(result => {
        newVideosByGenre[result.genreId] = result.videos;
    });
    
    setVideosByGenre(newVideosByGenre);

    setLoadingByGenre(prev => {
        const newLoadingState: LoadingByGenre = {};
        MOVIE_GENRES.forEach(g => newLoadingState[g.id] = false);
        return newLoadingState;
    });
  }, [dismissedItems, toast]);

  useEffect(() => {
    fetchAllGenres();
  }, [fetchAllGenres]);
  
  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Clapperboard className="h-8 w-8 text-primary" />
          Movies by Genre
        </h1>
      </div>
      
      <div className="flex flex-col gap-8 md:gap-12 lg:gap-16">
        {MOVIE_GENRES.map(genre => {
            const allVideosForGenre = videosByGenre[genre.id] || [];
            const carouselVideos = allVideosForGenre.slice(0, CAROUSEL_ITEM_LIMIT);
            const hasMore = allVideosForGenre.length > CAROUSEL_ITEM_LIMIT;
            const isLoading = loadingByGenre[genre.id] !== false;
            const href = `/movies/genre?id=${genre.id}&name=${encodeURIComponent(genre.name)}`;
            if (isLoading || carouselVideos.length > 0) {
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
              )
            }
            return null;
        })}
      </div>
    </div>
  );
}
