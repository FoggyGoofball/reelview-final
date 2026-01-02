import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { VideoCard } from '@/components/video/video-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export function GenreGridPage({ mediaType }: { mediaType: 'movie' | 'tv' | 'anime' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const genreId = params.get('id');
  const genreName = params.get('name') || '';
  const isKeyword = params.get('is_keyword') === '1';

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  // Determine if this is the Adult Animation genre page
  const isAdultAnimationGenre = mediaType === 'tv' && genreId === '16-adult';
  const isRegularAnimationGenre = mediaType === 'tv' && genreId === '16';

  const ITEMS_PER_PAGE = 40;
  const MAX_PAGES = 20; // Prevent infinite requests

  const fetchPage = async (pageNum: number, append: boolean = false) => {
    if (!pageNum || !genreId) return;
    
    const isLoading = append ? setLoadingMore : setLoading;
    isLoading(true);
    setError(null);

    try {
      let results: Video[] = append ? videos : [];
      let newSeen = append ? seen : new Set<string>();
      let itemsNeeded = ITEMS_PER_PAGE;
      let apiPage = pageNum;

      while (itemsNeeded > 0 && apiPage <= MAX_PAGES && hasMore) {
        try {
          // For Adult Animation, fetch from regular animation genre but filter explicitly
          const fetchGenreId = isAdultAnimationGenre ? '16' : genreId;
          const raw = await getVideosByGenre(fetchGenreId!, mediaType, isKeyword, apiPage);

          if (!raw || raw.length === 0) {
            setHasMore(false);
            break;
          }

          for (const basic of raw) {
            if (itemsNeeded <= 0) break;

            const key = `${mediaType}-${basic.id}`;
            if (newSeen.has(key)) continue;

            try {
              const enriched = await tmdbMediaToVideo(basic);
              if (enriched) {
                // Filtering rules:
                // - Exclude explicit for anime
                // - Exclude NR for movies
                // - For regular Animation genre: exclude explicit AND exclude asian/russian languages
                // - For Adult Animation genre: ONLY include explicit AND exclude asian/russian languages
                
                if (mediaType === 'anime' && enriched.is_explicit) continue;
                if (mediaType === 'movie' && enriched.rating === 'NR') continue;
                
                // Handle Animation genre special cases for TV
                if (mediaType === 'tv' && (isAdultAnimationGenre || isRegularAnimationGenre)) {
                  const asianOrRussianLanguages = ['ja', 'ko', 'zh', 'ru'];
                  
                  // Skip if has asian/russian language (belongs on Anime page)
                  if (asianOrRussianLanguages.includes(enriched.original_language || '')) {
                    continue;
                  }
                  
                  // For Adult Animation: include explicit content + TV-14 (appropriate for 16+)
                  if (isAdultAnimationGenre) {
                    if (enriched.is_explicit || enriched.rating === 'TV-14') {
                      results.push(enriched);
                      newSeen.add(key);
                      itemsNeeded--;
                    }
                    continue;
                  }
                  
                  // For Regular Animation: ONLY include non-explicit content (no TV-14, no TV-MA, etc.)
                  if (isRegularAnimationGenre && !enriched.is_explicit) {
                    results.push(enriched);
                    newSeen.add(key);
                    itemsNeeded--;
                  }
                  continue;
                }
                
                results.push(enriched);
                newSeen.add(key);
                itemsNeeded--;
              }
            } catch (e) {
              console.error('[GENRE GRID] Failed to enrich video', basic?.id, e);
            }
          }
          
          apiPage++;
        } catch (fetchErr: any) {
          console.error('[GENRE GRID] Failed to fetch page', apiPage, 'for', genreId, 'mediaType', mediaType, fetchErr);
          setError(`Failed to fetch data (page ${apiPage}).`);
          break;
        }
      }

      setVideos(results);
      setSeen(newSeen);
      setHasMore(itemsNeeded > 0 && apiPage <= MAX_PAGES); // Has more if we got full page and haven't hit max
    } catch (e: any) {
      console.error('[GENRE GRID] Unexpected error:', e);
      setError('Unexpected error while fetching genre data.');
    } finally {
      isLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setSeen(new Set());
    setVideos([]);
    setHasMore(true);
    fetchPage(1, false);
  }, [genreId, genreName, isKeyword, mediaType, isAdultAnimationGenre, isRegularAnimationGenre]);

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchPage(nextPage, true);
  };

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-red-500">{genreName || 'Genre'}</h1>
      {error && (
        <div className="p-4 mb-6 rounded bg-red-600/10 border border-red-600/20 text-red-500">
          <strong>Error:</strong> {error}
        </div>
      )}
      {loading && videos.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-8">
            {videos.map(video => (
              <VideoCard key={`${video.media_type}-${video.id}`} video={video} />
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center mt-12">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                size="lg"
                className="gap-2"
              >
                {loadingMore ? (
                  <>
                    <span className="animate-spin">?</span>
                    Loading More...
                  </>
                ) : (
                  <>
                    Load More
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
          
          {!hasMore && videos.length > 0 && (
            <div className="text-center mt-12 text-muted-foreground">
              No more {genreName.toLowerCase()} to load
            </div>
          )}
        </>
      )}
    </div>
  );
}
