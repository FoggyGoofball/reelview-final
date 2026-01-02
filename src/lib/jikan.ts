
// A simple client for the Jikan API (MyAnimeList unofficial API)
// https://jikan.moe/

import pThrottle from 'p-throttle';
import type { Video } from './data';

const JIKAN_API_URL = 'https://api.jikan.moe/v4';

// Jikan has a rate limit of 3 requests per second. Let's be very conservative.
const throttle = pThrottle({
  limit: 1, 
  interval: 1000, // 1 second
});

const jikanFetch = throttle(async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    // For 404 errors, it's not a server failure, just a lack of data.
    // We can return null and let the caller handle it.
    if (response.status === 404) {
        const errorBody = await response.text();
        console.info(`Jikan API Info: ${response.status} ${response.statusText}. Resource not found.`, errorBody);
        return null;
    }
    // For other errors (500, 429, etc.), we should throw.
    const errorBody = await response.text();
    console.error(`Jikan API Error: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Failed to fetch from Jikan: ${response.statusText}`);
  }
  return response.json();
});

export interface JikanAnime {
  mal_id: number;
  title: string;
  synopsis: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  genres: { mal_id: number; name: string }[];
  score: number;
  year: number;
  episodes: number;
  status: string;
  rating: string;
}

export interface JikanEpisode {
    mal_id: number;
    title: string;
    synopsis: string;
}

interface JikanPagedResponse<T> {
  data: T[];
}

// Simple in-memory cache for the current session to ensure this list is fresh on each new visit.
const animeCache = new Map<string, JikanAnime>();
const externalIdCache = new Map<string, string | null>();


async function getAnimeById(id: string): Promise<JikanAnime | null> {
    if (animeCache.has(id)) {
        return animeCache.get(id)!;
    }
    try {
        const result = await jikanFetch(`${JIKAN_API_URL}/anime/${id}`);
        if (!result) {
            return null;
        }
        const data = result.data;
        animeCache.set(id, data);
        return data;
    } catch(e) {
        console.error(`Failed to fetch anime with id ${id}`, e);
        return null;
    }
}

export function jikanAnimeToVideo(anime: JikanAnime, tmdbId: string): Video {
    return {
        // CRITICAL: Always use the TMDB ID as the primary ID for consistency.
        id: tmdbId,
        mal_id: anime.mal_id,
        title: anime.title,
        description: anime.synopsis,
        categories: anime.genres.map(g => g.name),
        // Use Jikan images as they are often higher quality for anime.
        thumbnailSeed: anime.images.jpg.large_image_url,
        poster_path: anime.images.jpg.large_image_url,
        media_type: 'anime',
        vote_average: anime.score,
        release_date: String(anime.year),
        episodes: anime.episodes,
        status: anime.status,
        rating: anime.rating,
    }
}

export async function getFullAnimeDetails(id: string): Promise<JikanAnime | null> {
    return getAnimeById(id);
}

export async function getAnimeEpisodes(animeId: string): Promise<JikanEpisode[]> {
    const data = await jikanFetch(`${JIKAN_API_URL}/anime/${animeId}/episodes`);
    if (!data) return [];
    return (data as JikanPagedResponse<JikanEpisode>).data;
}

export async function searchAnime(query: string): Promise<JikanAnime[]> {
    const data = await jikanFetch(`${JIKAN_API_URL}/anime?q=${encodeURIComponent(query)}&order_by=rank&sort=asc`);
    if (!data) return [];
    return (data as JikanPagedResponse<JikanAnime>).data;
}

export async function findTmdbIdByMalId(malId: string): Promise<string | null> {
    if (externalIdCache.has(malId)) {
        return externalIdCache.get(malId)!;
    }
    try {
        const result = await jikanFetch(`${JIKAN_API_URL}/anime/${malId}/external`);
        if (!result || !Array.isArray(result.data)) {
            externalIdCache.set(malId, null);
            return null;
        }
        const data = result.data;
        const tmdbEntry = data.find((entry: any) => entry.name === 'TheMovieDB');
        const tmdbId = tmdbEntry ? tmdbEntry.url.split('/').pop() : null;
        externalIdCache.set(malId, tmdbId);
        return tmdbId;
    } catch (e) {
        console.error(`Could not find external IDs for MAL ID ${malId}`, e);
        externalIdCache.set(malId, null);
        return null;
    }
}
