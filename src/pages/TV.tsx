'use client';
import React, { useState, useEffect, useCallback, memo } from 'react';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video, Category } from '@/lib/data';
import { VideoCarousel } from '@/components/video/video-carousel';
import { Clapperboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDismissed } from '@/context/dismissed-context';
import { TMDBMedia } from '@/lib/tmdb';

const TV_GENRES: Category[] = [
    { id: '10759', name: 'Action & Adventure' },
    { id: '35', name: 'Comedy' },
    { id: '80', name: 'Crime' },
    { id: '99', name: 'Documentary' },
    { id: '18', name: 'Drama' },
    { id: '10751', name: 'Family' },
    { id: '10765', name: 'Sci-Fi & Fantasy' },
];

const ANIMATION_GENRE: Category = { id: '16', name: 'Animation' };
const ADULT_ANIMATION_GENRE: Category = { id: '16-adult', name: 'Adult Animation' };
const SPECIAL_GENRES: Category[] = [ANIMATION_GENRE, ADULT_ANIMATION_GENRE];

const CAROUSEL_ITEM_LIMIT = 7;
const CAROUSEL_FETCH_LIMIT = 8;
const ANIMATION_GENRE_ID = '16';
const ADULT_ANIMATION_ID = '16-adult';

type VideosByGenre = Record<string, Video[]>;
type LoadingByGenre = Record<string, boolean>;

const MemoizedVideoCarousel = memo(VideoCarousel);

const fetchStandardGenres = async (
    dismissedItems: Record<string, Video>,
    allProcessedIds: Set<string>,
    toast: (options: any) => void
) => {
    const promises = TV_GENRES.map(async (genre) => {
        try {
            let page = 1;
            const processedVideos: Video[] = [];
            while (processedVideos.length < CAROUSEL_FETCH_LIMIT && page <= 5) {
                // Pass true for the 'excludeAnimation' parameter
                const rawMedia: TMDBMedia[] = await getVideosByGenre(genre.id, 'tv', false, page, true);
                if (!rawMedia || rawMedia.length === 0) break;

                for (const basicVideo of rawMedia) {
                    if (processedVideos.length >= CAROUSEL_FETCH_LIMIT) break;
                    const videoKey = `tv-${basicVideo.id}`;
                    if (dismissedItems[videoKey] || allProcessedIds.has(videoKey)) continue;

                    const enrichedVideo = await tmdbMediaToVideo(basicVideo);
                    // Explicitly exclude anime from TV genres
                    if (enrichedVideo && enrichedVideo.media_type !== 'anime') {
                        allProcessedIds.add(videoKey);
                        processedVideos.push(enrichedVideo);
                    }
                }
                page++;
            }
            return { genreId: genre.id, videos: processedVideos };
        } catch (error: any) {
            console.error(`[Fetch] ERROR: Failed to fetch shows for genre "${genre.name}". Reason: ${error.message}`);
            toast({ variant: "destructive", title: "Failed to load TV shows", description: `Could not load ${genre.name}.` });
            return { genreId: genre.id, videos: [] };
        }
    });
    return Promise.all(promises);
};

const fetchAnimationGenres = async (
    dismissedItems: Record<string, Video>,
    allProcessedIds: Set<string>,
    toast: (options: any) => void
) => {
    try {
        const animationPagePromises = [1, 2, 3, 4, 5].map(page => getVideosByGenre(ANIMATION_GENRE_ID, 'tv', false, page));
        const animationPages = await Promise.all(animationPagePromises);
        const animationRawMedia: TMDBMedia[] = animationPages.flat().filter(Boolean);

        const uniqueAnimatedShows = Array.from(new Map(animationRawMedia.map(v => [`tv-${v.id}`, v])).values());

        const adultAnimation: Video[] = [];
        const regularAnimation: Video[] = [];

        for (const basicVideo of uniqueAnimatedShows) {
            const videoKey = `tv-${basicVideo.id}`;
            if (allProcessedIds.has(videoKey) || dismissedItems[videoKey]) continue;

            const enrichedVideo = await tmdbMediaToVideo(basicVideo);
            
            // Ensure we are not adding anime to the animation carousels on the TV page
            if (enrichedVideo && enrichedVideo.media_type !== 'anime') {
                // ALSO exclude animated shows with Asian or Russian original language
                // Those belong on the Anime page, not the Animation/Adult Animation carousels
                const asianOrRussianLanguages = ['ja', 'ko', 'zh', 'ru'];
                if (asianOrRussianLanguages.includes(enrichedVideo.original_language || '')) {
                    continue; // Skip this show - it should be on anime page only
                }
                
                allProcessedIds.add(videoKey);
                if (enrichedVideo.is_explicit && adultAnimation.length < CAROUSEL_FETCH_LIMIT) {
                    adultAnimation.push(enrichedVideo);
                } else if (!enrichedVideo.is_explicit && regularAnimation.length < CAROUSEL_FETCH_LIMIT) {
                    regularAnimation.push(enrichedVideo);
                }
            }
             if (adultAnimation.length >= CAROUSEL_FETCH_LIMIT && regularAnimation.length >= CAROUSEL_FETCH_LIMIT) {
                break;
            }
        }
        
        return {
            [ADULT_ANIMATION_ID]: adultAnimation,
            [ANIMATION_GENRE_ID]: regularAnimation
        };
    } catch (error: any) {
        console.error(`[Fetch] ERROR: Failed to fetch animation data. Reason: ${error.message}`);
        toast({ variant: "destructive", title: "Failed to load Animation", description: "There was an error loading animated content." });
        return { [ADULT_ANIMATION_ID]: [], [ANIMATION_GENRE_ID]: [] };
    }
};

const CarouselRenderer = ({ genre }: { genre: Category }) => {
    const { videosByGenre, loadingByGenre, handleDismiss } = useTvGenresContext();
    const allVideos = videosByGenre[genre.id] || [];
    const carouselVideos = allVideos.slice(0, CAROUSEL_ITEM_LIMIT);
    const hasMore = allVideos.length > CAROUSEL_ITEM_LIMIT;
    const isLoading = loadingByGenre[genre.id] !== false;
    const href = `/tv/genre?id=${genre.id}&name=${encodeURIComponent(genre.name)}`;
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
}

const TvGenresContext = React.createContext<{
  videosByGenre: VideosByGenre;
  loadingByGenre: LoadingByGenre;
  handleDismiss: (video: Video) => void;
} | undefined>(undefined);

const useTvGenresContext = () => {
    const context = React.useContext(TvGenresContext);
    if (!context) {
        throw new Error('useTvGenresContext must be used within a TvGenresProvider');
    }
    return context;
}

export default function TvGenresPage() {
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

  const fetchAllData = useCallback(async () => {
    const allGenres = [...TV_GENRES, ...SPECIAL_GENRES];
    setLoadingByGenre(prev => {
        const newLoadingState = {...prev};
        allGenres.forEach(g => { newLoadingState[g.id] = true });
        return newLoadingState;
    });

    const allProcessedIds = new Set<string>();

    const [standardGenreResults, animationResults] = await Promise.all([
        fetchStandardGenres(dismissedItems, allProcessedIds, toast),
        fetchAnimationGenres(dismissedItems, allProcessedIds, toast)
    ]);

    const newVideosByGenre: VideosByGenre = { ...animationResults };
    standardGenreResults.forEach(result => {
        newVideosByGenre[result.genreId] = result.videos;
    });

    setVideosByGenre(newVideosByGenre);

    setLoadingByGenre(prev => {
        const newLoadingState = {...prev};
        allGenres.forEach(g => { newLoadingState[g.id] = false; });
        return newLoadingState;
    });
  }, [dismissedItems, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);
  
  return (
    <TvGenresContext.Provider value={{ videosByGenre, loadingByGenre, handleDismiss }}>
        <div className="container max-w-screen-2xl py-8 md:py-12">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Clapperboard className="h-8 w-8 text-primary" />
            TV Shows by Genre
            </h1>
        </div>
        
        <div className="flex flex-col gap-8 md:gap-12 lg:gap-16">
            <CarouselRenderer genre={ANIMATION_GENRE} />
            {TV_GENRES.map(genre => <CarouselRenderer key={genre.id} genre={genre} />)}
            <CarouselRenderer genre={ADULT_ANIMATION_GENRE} />
        </div>
        </div>
    </TvGenresContext.Provider>
  );
}
