// A simple client for the The Movie Database (TMDB) API
// https://www.themoviedb.org/

import pThrottle from 'p-throttle';
import type { Video } from './data';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_REGION = 'US';

// TMDB has a rate limit of 50 requests per second. We can be a bit more generous here.
const throttle = pThrottle({
	limit: 10,
	interval: 1000
});

function getApiKey(): string | null {
    if (typeof window === 'undefined') {
        // During `next build`, process.env is available.
        // THIS IS A PLACEHOLDER and not secure for a real production app.
        // In a real app, this would be a secret passed during the build process.
        return process.env.TMDB_API_KEY || '3fa2f58b01fc2153fe716cb40c39dddf';
    }
    return localStorage.getItem('TMDB_API_KEY');
}

export const tmdbFetch = throttle(async (path: string, params: Record<string, string> = {}, options: RequestInit = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    // Don't even attempt to fetch if the API key isn't set.
    // This prevents console errors on the initial page load.
    if (typeof window !== 'undefined') {
        console.warn("TMDB API key is not set. Please set it in the application settings.");
    }
    return null;
  }
  
  const url = new URL(`${TMDB_API_URL}${path}`);
  url.searchParams.append('api_key', apiKey);
  url.searchParams.append('language', 'en-US');
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  
  const response = await fetch(url.toString(), options);
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`TMDB API Error: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Failed to fetch from TMDB: ${response.statusText}`);
  }
  
  return response.json();
});

// Type definitions for TMDB API responses
export interface TMDBMedia {
    id: number;
    title?: string;
    name?: string;
    overview: string;
    poster_path: string;
    backdrop_path: string;
    media_type: 'movie' | 'tv';
    genre_ids?: number[];
    popularity?: number;
    vote_average: number;
    release_date?: string; // For movies
    first_air_date?: string; // For TV shows
    original_language?: string;

    // These are added by our enrichment process
    genres?: {id: number, name: string}[];
    content_ratings?: { results: { iso_3166_1: string, rating: string }[] };
    release_dates?: { results: { iso_3166_1: string, release_dates: { certification: string }[] }[] };
}

export interface TMDBMovie extends TMDBMedia {
    media_type: 'movie';
    title: string;
    release_date: string;
    runtime?: number;
}

export interface TMDBTvShow extends TMDBMedia {
    media_type: 'tv';
    name: string;
    first_air_date: string;
    seasons?: { season_number: number, episode_count: number, name: string }[];
    episode_run_time?: number[];
    external_ids?: {
        imdb_id: string | null;
        tvdb_id: number | null;
        myanimelist_id: number | null;
    };
}

export interface TMDBEpisode {
    episode_number: number;
    name: string;
    overview: string;
    still_path: string;
}

export interface TMDBPagedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export async function getPopularMovies(page = 1): Promise<TMDBMovie[] | null> {
    const data = await tmdbFetch('/movie/popular', { page: String(page) }) as TMDBPagedResponse<TMDBMovie>;
    if (!data) return null;
    data.results.forEach(m => m.media_type = 'movie');
    return data.results;
}

export async function getPopularTvShows(page = 1): Promise<TMDBTvShow[] | null> {
    const data = await tmdbFetch('/tv/popular', { page: String(page) }) as TMDBPagedResponse<TMDBTvShow>;
    if (!data) return null;
    data.results.forEach(m => m.media_type = 'tv');
    return data.results;
}

export async function getMediaDetails<T extends 'movie' | 'tv'>(
    id: string,
    type: T,
    params: Record<string, string> = {}
): Promise<(T extends 'movie' ? TMDBMovie : TMDBTvShow) | null> {
    const path = `/${type}/${id}`;
    const data = await tmdbFetch(path, params);
    if (!data) return null;
    data.media_type = type;
    return data;
}

export async function getTvSeasonDetails(tvId: string, seasonNumber: number): Promise<{episodes: TMDBEpisode[]} | null> {
    const path = `/tv/${tvId}/season/${seasonNumber}`;
    const data = await tmdbFetch(path);
    return data;
}


// A helper to consistently get the US content rating.
export function getTmdbRating(media: TMDBMedia): string | undefined {
    let rating: string | undefined = undefined;

    // For movies, the certification is in release_dates.
    if (media.release_dates) {
        const usRelease = media.release_dates.results.find(r => r.iso_3166_1 === TMDB_REGION);
        if (usRelease && usRelease.release_dates.length > 0) {
            // Find the first non-empty certification.
            rating = usRelease.release_dates.find(rd => rd.certification)?.certification;
        }
    }

    // For TV shows, it's in content_ratings.
    if (!rating && media.content_ratings) {
        const usRating = media.content_ratings.results.find(r => r.iso_3166_1 === TMDB_REGION);
        if (usRating) {
            rating = usRating.rating;
        }
    }
    
    // Fallback if no US rating is found
    if (!rating && media.content_ratings?.results?.length) {
        rating = media.content_ratings.results[0].rating;
    }
    if (!rating && media.release_dates?.results?.length) {
        rating = media.release_dates.results[0].release_dates.find(rd => rd.certification)?.certification;
    }

    return rating;
}
