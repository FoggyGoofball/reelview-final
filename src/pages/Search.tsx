
'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchVideos, tmdbMediaToBasicVideo, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { VideoCard } from '@/components/video/video-card';
import { Search } from 'lucide-react';
import { ApiKeyNotice } from '@/components/api-key-notice';
import { Skeleton } from '@/components/ui/skeleton';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const isAnimeSearch = searchParams.get('is_anime_search') === 'true';
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const key = localStorage.getItem('TMDB_API_KEY');
    setApiKey(key);
  }, []);
  
  useEffect(() => {
    if (isMounted && apiKey && query) {
      setIsLoading(true);
      setVideos([]); // Clear previous results

      const processSearch = async () => {
        try {
          const results = await searchVideos(query, isAnimeSearch);
          if (!results) {
            setIsLoading(false);
            return;
          };
          
          const initialVideos = results.map(tmdbMediaToBasicVideo);
          setVideos(initialVideos);
          setIsLoading(false);

          for (const basicVideo of initialVideos) {
              tmdbMediaToVideo(basicVideo).then(enrichedVideo => {
                  if (enrichedVideo) {
                      setVideos(currentVideos => {
                         const newVideos = currentVideos.map(v => 
                            (v.id === enrichedVideo.id && v.media_type === enrichedVideo.media_type) ? enrichedVideo : v
                         );
                         return newVideos;
                      });
                  }
              });
          }
        } catch (err) {
            console.error("Failed to search videos:", err);
            setIsLoading(false);
        }
      }

      processSearch();

    } else if (isMounted) {
      setVideos([]);
    }
  }, [query, apiKey, isAnimeSearch, isMounted]);

  if (!isMounted) {
    return (
       <div className="container max-w-screen-2xl py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          Search
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyNotice />;
  }

  const pageTitle = isAnimeSearch ? `Anime Results for "${query}"` 
                    : query ? `Search Results for "${query}"` 
                    : 'Search';

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
        <Search className="h-8 w-8 text-primary" />
        {pageTitle}
      </h1>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {videos.map(video => (
            <VideoCard key={`${video.media_type}-${video.id}`} video={video} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-secondary rounded-lg">
          {query && !isLoading ? (
            <>
              <p className="text-lg text-muted-foreground">No results found for "{query}".</p>
              <p className="text-sm text-muted-foreground/70">Try searching for something else.</p>
            </>
          ) : (
             <p className="text-lg text-muted-foreground">Search for a video in the search bar above.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

    