
import {
  getMediaDetails,
  getPopularMovies as tmdbGetPopularMovies,
  getPopularTvShows as tmdbGetPopularTvShows,
  getTmdbRating,
  TMDBMedia,
  TMDBMovie,
  TMDBPagedResponse,
  tmdbFetch,
  TMDBTvShow
} from './tmdb';
import { getFullAnimeDetails, searchAnime } from '@/lib/jikan';
import { type Video, type Category, EXPLICIT_RATINGS } from './data';

// Simple in-memory cache for anime ratings to avoid hitting rate limits on searches.
const animeRatingCache = new Map<string, string | undefined>();


export function tmdbMediaToBasicVideo(media: TMDBMedia): Video {
  const isMovie = media.media_type === 'movie';
  const isAsianAnimation = ['ja', 'ko', 'zh'].includes(media.original_language || '');
  let isAnimeShow = media.media_type === 'tv' && (media.genre_ids?.includes(16) && isAsianAnimation);

  const title = isMovie ? media.title || '' : media.name || '';
  
  const rating = getTmdbRating(media);

  return {
    id: String(media.id),
    title: title,
    name: title,
    description: media.overview,
    categories: [], // Not available in basic media object
    thumbnailSeed: media.backdrop_path || '',
    poster_path: media.poster_path || '',
    media_type: isAnimeShow ? 'anime' : media.media_type,
    vote_average: media.vote_average,
    release_date: isMovie ? media.release_date : media.first_air_date,
    original_language: media.original_language,
    genre_ids: media.genre_ids,
    rating: rating,
    is_explicit: rating ? EXPLICIT_RATINGS.some(er => rating!.includes(er)) : false,
  }
}

export async function tmdbMediaToVideo(media: TMDBMedia): Promise<Video | null> {
  const isMovie = media.media_type === 'movie';
  const typeToFetch = (media.media_type === 'anime') ? 'tv' : media.media_type;
  
  const basicVideo = tmdbMediaToBasicVideo(media);

  const detailedMedia = await getMediaDetails(String(media.id), typeToFetch, { append_to_response: 'keywords,external_ids,content_ratings,release_dates' });
  
  if (!detailedMedia) {
    // On the server, without an API key, this will return null.
    // We MUST return the basic info we have to avoid a crash.
    return basicVideo;
  }
  
  const isAsianAnimation = ['ja', 'ko', 'zh'].includes(detailedMedia.original_language || '');
  let isAnimeShow = typeToFetch === 'tv' && (detailedMedia.genres?.some(g => g.id === 16) && isAsianAnimation);

  let rating = getTmdbRating(detailedMedia);
  const title = isMovie ? detailedMedia.title || '' : detailedMedia.name || '';

  if (isAnimeShow) {
      if (animeRatingCache.has(title)) {
        rating = animeRatingCache.get(title);
      } else {
        const malId = (detailedMedia as TMDBTvShow).external_ids?.myanimelist_id;
        if (malId) {
            try {
                const jikanDetails = await getFullAnimeDetails(String(malId));
                if (jikanDetails?.rating) {
                    rating = jikanDetails.rating;
                }
            } catch (e) {
                console.warn(`[api.ts] Could not enrich anime rating from Jikan for MAL ID ${malId}`, e);
            }
        }
        
        // Fallback to searching by title if direct lookup fails or is unavailable
        if (!rating) {
             try {
                const searchResults = await searchAnime(title);
                if (searchResults && searchResults.length > 0 && searchResults[0].rating) {
                    rating = searchResults[0].rating;
                }
            } catch (e) {
                console.error(`[api.ts] Could not enrich anime rating via search for title "${title}"`, e);
            }
        }

        animeRatingCache.set(title, rating);
      }
  }

  const runtime = isMovie
    ? (detailedMedia as TMDBMovie).runtime
    : (detailedMedia as TMDBTvShow).episode_run_time?.[0];

  const keywordsList = (detailedMedia as any).keywords?.results || (detailedMedia as any).keywords?.keywords || [];

  const video: Video = {
    id: String(detailedMedia.id),
    title: title,
    name: title,
    description: detailedMedia.overview,
    categories: detailedMedia.genres?.map(g => g.name) || [],
    thumbnailSeed: detailedMedia.backdrop_path || '',
    poster_path: detailedMedia.poster_path || '',
    media_type: isAnimeShow ? 'anime' : detailedMedia.media_type,
    vote_average: detailedMedia.vote_average,
    release_date: isMovie ? detailedMedia.release_date : detailedMedia.first_air_date,
    seasons: detailedMedia.media_type === 'tv' ? detailedMedia.seasons : undefined,
    original_language: detailedMedia.original_language,
    genre_ids: detailedMedia.genres?.map(g => g.id) || [],
    keywords: keywordsList,
    rating: rating,
    runtime: runtime,
    external_ids: (detailedMedia as TMDBTvShow).external_ids,
  };
  
  if ((detailedMedia as TMDBTvShow).external_ids?.myanimelist_id) {
    video.mal_id = (detailedMedia as TMDBTvShow).external_ids.myanimelist_id;
  }
  
  // Final explicit check after all enrichment attempts
  const isPornographic = rating ? ['Rx', 'Hentai'].some(pr => rating!.includes(pr)) : false;
  
  const isHorrorGenre = video.genre_ids?.includes(27);
  if (isHorrorGenre && video.media_type === 'anime') {
    video.is_explicit = isPornographic;
  } else {
    video.is_explicit = rating ? EXPLICIT_RATINGS.some(er => rating!.includes(er)) : false;
  }

  return video;
}


export async function getVideos(): Promise<TMDBMovie[]> {
  const popular = await tmdbGetPopularMovies();
  return popular || [];
}

export async function getPopularTvShows(): Promise<TMDBTvShow[]> {
    const shows = await tmdbGetPopularTvShows();
    return shows || [];
}

export async function getVideoById(id: string, media_type: 'movie' | 'tv' | 'anime'): Promise<Video | undefined> {
  const typeToFetch: 'movie' | 'tv' = (media_type === 'anime') ? 'tv' : media_type;
  try {
      const media = await getMediaDetails(id, typeToFetch);
      if (!media?.id) {
        return undefined;
      }
      
      const video = await tmdbMediaToVideo(media);
      
      if (!video) {
        return undefined;
      }
      
      if (media_type === 'anime') {
           video.media_type = 'anime';
      }

      return video || undefined;
  } catch (e) {
      console.error(`[api.ts] Failed to get video by id: ${id}`, e);
      return undefined;
  }
}

export async function getCategories(mediaType: 'movie' | 'tv' | 'anime'): Promise<Category[]> {
    if (mediaType === 'anime') {
        return [
            { id: '10759', name: 'Action & Adventure' },
            { id: '35', name: 'Comedy' },
            { id: '18', name: 'Drama' },
            { id: '10765', name: 'Sci-Fi & Fantasy' },
            { id: '210024', name: 'Shonen', is_keyword: true },
            { id: '9937', name: 'Slice of Life', is_keyword: true },
        ];
    }
    const path = mediaType === 'movie' ? '/genre/movie/list' : '/genre/tv/list';
    const data = await tmdbFetch(path);
    if (!data || !data.genres) return [];
    return data.genres;
}

export async function getVideosByGenre(genreId: string, mediaType: 'movie' | 'tv' | 'anime', isKeyword: boolean = false, page: number = 1, excludeAnimation: boolean = false): Promise<TMDBMedia[]> {
    const typeToFetch = mediaType === 'anime' ? 'tv' : mediaType;

    const path = `/discover/${typeToFetch}`;
    let params: Record<string, string> = { sort_by: 'popularity.desc', page: String(page) };

    const animationGenreId = '16';

    if (mediaType === 'anime') {
        params['with_original_language'] = 'ja'; // Explicitly fetch only Japanese language for anime
        if (isKeyword) {
            params['with_keywords'] = genreId;
            params['with_genres'] = animationGenreId; // Always combine with Animation for keyword-based anime search
        } else {
            params['with_genres'] = `${animationGenreId},${genreId}`;
        }
    } else if (mediaType === 'tv') {
        params['with_genres'] = genreId;
        // For TV, exclude languages that are typically anime
        params['without_original_language'] = 'ja,ko,zh';
        if (excludeAnimation && genreId !== animationGenreId) {
             params['without_genres'] = animationGenreId;
        }
    } else { // movie
        params['with_genres'] = genreId;
    }
    
    const response = await tmdbFetch(path, params) as TMDBPagedResponse<TMDBMedia>;
    if (!response || !response.results) {
        return [];
    }
    
    // Add media_type to results, as discover endpoint doesn't include it
    response.results.forEach(item => item.media_type = typeToFetch);

    return response.results;
}


export async function searchVideos(query: string, isAnimeSearch = false): Promise<TMDBMedia[]> {
  if (!query) {
    return [];
  }
  
  if (isAnimeSearch) {
    const data = await tmdbFetch('/search/tv', {
      query: query,
      with_keywords: '210024', // anime keyword
      include_adult: 'false',
    }) as TMDBPagedResponse<TMDBMedia>;
    if (data && data.results) {
        data.results.forEach(item => item.media_type = 'tv');
        return data.results || [];
    }
    return [];
  }

  const pagePromises = [
    tmdbFetch('/search/multi', { query, include_adult: 'false', page: '1' }),
    tmdbFetch('/search/multi', { query, include_adult: 'false', page: '2' }),
    tmdbFetch('/search/multi', { query, include_adult: 'false', page: '3' }),
  ];
  
  const pages = await Promise.all(pagePromises);
  const allResults = pages.filter(Boolean).flatMap(page => (page as TMDBPagedResponse<TMDBMedia>).results || []);

  const uniqueResults = new Map<number, TMDBMedia>();
  allResults.forEach(item => {
    if ((item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path) {
      if (!uniqueResults.has(item.id)) {
        uniqueResults.set(item.id, item);
      }
    }
  });

  const sortedResults = Array.from(uniqueResults.values()).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return sortedResults;
}


export async function getLatestAnime(): Promise<TMDBTvShow[]> {
    const tmdbResults = await tmdbFetch('/discover/tv', {
        with_keywords: '210024', // anime keyword
        sort_by: 'popularity.desc',
        'air_date.gte': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        include_adult: 'false'
    }) as TMDBPagedResponse<TMDBTvShow>;

    if (!tmdbResults || !tmdbResults.results) {
        return [];
    }
    
    tmdbResults.results.forEach(r => r.media_type = 'tv');

    return tmdbResults.results;
}
