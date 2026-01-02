import { type Video, type WatchProgress, type CustomVideoData } from './data';
import { tmdbMediaToVideo } from './api';

const HISTORY_KEY = 'vidLinkProgress';
const WATCHLIST_KEY = 'vidLinkWatchlist';
const CUSTOM_DATA_KEY = 'vidLinkCustomData';
const DISMISSED_KEY = 'vidLinkDismissed';

function isServer(): boolean {
  return typeof window === 'undefined';
}

// --- Watch History ---

export function getWatchHistory(): Record<string, WatchProgress> {
  if (isServer()) return {};
  try {
    const historyJson = localStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : {};
  } catch (error) {
    console.error("Failed to parse watch history", error);
    return {};
  }
}

export function saveWatchProgress(progress: WatchProgress) {
    if (isServer() || (!progress.id && !progress.mal_id)) {
        return;
    }
    try {
        const currentHistory = getWatchHistory();
        const key = progress.type === 'anime' && progress.mal_id
            ? `mal-${progress.mal_id}` 
            : `tmdb-${progress.id}`;
        
        const updatedHistory = {
            ...currentHistory,
            [key]: {
                ...currentHistory[key],
                ...progress,
                last_updated: Date.now(),
            }
        };
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        window.dispatchEvent(new CustomEvent('history-updated', { detail: updatedHistory }));
    } catch (error) {
        console.error("Failed to save history", error);
    }
}

export function removeFromHistory(id: string, type: 'movie' | 'tv' | 'anime', mal_id?: number) {
    if (isServer()) return;
    const currentHistory = getWatchHistory();
    const key = type === 'anime' && mal_id
            ? `mal-${mal_id}` 
            : `tmdb-${id}`;
    delete currentHistory[key];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(currentHistory));
    window.dispatchEvent(new CustomEvent('history-updated', { detail: currentHistory }));
}


// --- Watchlist ---

export function getWatchlist(): Record<string, Video> {
  if (isServer()) return {};
  try {
    const watchlistJson = localStorage.getItem(WATCHLIST_KEY);
    return watchlistJson ? JSON.parse(watchlistJson) : {};
  } catch (error) {
    console.error("Failed to parse watchlist", error);
    return {};
  }
}

function saveWatchlist(watchlist: Record<string, Video>) {
    if (isServer()) return;
    try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
        window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: watchlist }));
    } catch (error) {
        console.error("Failed to save watchlist", error);
    }
}

export function addToWatchlist(video: Video) {
    const currentWatchlist = getWatchlist();
    const key = `${video.media_type}-${video.id}`;
    currentWatchlist[key] = video;
    saveWatchlist(currentWatchlist);
}

export function removeFromWatchlist(videoId: string, mediaType: 'movie' | 'tv' | 'anime') {
    const currentWatchlist = getWatchlist();
    const key = `${mediaType}-${videoId}`;
    delete currentWatchlist[key];
    saveWatchlist(currentWatchlist);
}

export function isInWatchlist(videoId: string, mediaType: 'movie' | 'tv' | 'anime'): boolean {
    const watchlist = getWatchlist();
    const key = `${mediaType}-${videoId}`;
    return !!watchlist[key];
}


// --- Custom Video Data ---

export function getCustomVideoData(): Record<string, CustomVideoData> {
  if (isServer()) return {};
  try {
    const customDataJson = localStorage.getItem(CUSTOM_DATA_KEY);
    return customDataJson ? JSON.parse(customDataJson) : {};
  } catch (error) {
    console.error("Failed to parse custom video data", error);
    return {};
  }
}

export function saveCustomVideoData(videoKey: string, data: CustomVideoData) {
    if (isServer()) return;
    try {
        const currentData = getCustomVideoData();
        const updatedData = {
            ...currentData,
            [videoKey]: data
        };
        localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(updatedData));
    } catch (error) {
        console.error("Failed to save custom video data", error);
    }
}

// --- Dismissed Items ---

export function getDismissedItems(): Record<string, Video> {
  if (isServer()) return {};
  try {
    const dismissedJson = localStorage.getItem(DISMISSED_KEY);
    return dismissedJson ? JSON.parse(dismissedJson) : {};
  } catch (error) {
    console.error("Failed to parse dismissed items", error);
    return {};
  }
}

function saveDismissed(dismissed: Record<string, Video>) {
    if (isServer()) return;
    try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
        window.dispatchEvent(new CustomEvent('dismissed-updated', { detail: dismissed }));
    } catch (error) {
        console.error("Failed to save dismissed items", error);
    }
}

export function addToDismissed(video: Video) {
    const currentDismissed = getDismissedItems();
    const key = `${video.media_type}-${video.id}`;
    currentDismissed[key] = video;
    saveDismissed(currentDismissed);
}

export function removeFromDismissed(video: Video) {
    const currentDismissed = getDismissedItems();
    const key = `${video.media_type}-${video.id}`;
    delete currentDismissed[key];
    saveDismissed(currentDismissed);
}

export function isDismissed(videoId: string, mediaType: 'movie' | 'tv' | 'anime'): boolean {
    const dismissed = getDismissedItems();
    const key = `${mediaType}-${videoId}`;
    return !!dismissed[key];
}

// --- Data Enrichment ---

/**
 * Enriches a Video or WatchProgress object with detailed information like rating, runtime, and seasons.
 * @param item The Video or WatchProgress item to enrich.
 * @returns A promise that resolves to the enriched item.
 */
export async function enrichVideoDetails<T extends Video | WatchProgress>(item: T): Promise<T> {
    const isVideoObject = 'media_type' in item;
    const mediaType = isVideoObject ? item.media_type : item.type;
    const itemId = String(item.id);

    const needsEnrichment = !item.rating || !(item as Video).runtime || (mediaType !== 'movie' && !(item as Video).seasons);
    
    if (!needsEnrichment) {
        return item;
    }
    
    try {
        const typeToFetch = mediaType === 'anime' ? 'tv' : mediaType;

        const enrichedVideo = await tmdbMediaToVideo({
            id: Number(itemId),
            media_type: typeToFetch,
            title: item.title,
            name: item.title,
            overview: '',
            poster_path: '',
            backdrop_path: '',
            genre_ids: [],
            release_date: '',
            first_air_date: '',
            vote_average: 0,
        });

        if (!enrichedVideo) {
          return item;
        }

        const finalItem = {
            ...item,
            rating: enrichedVideo.rating,
            runtime: enrichedVideo.runtime,
            is_explicit: enrichedVideo.is_explicit,
            seasons: enrichedVideo.seasons,
            episodes: enrichedVideo.episodes,
        };
        
        // This is a bit of a type assertion hack, but it's safe here
        return finalItem as T;

    } catch (e) {
        console.error(`[client-api] enrichVideoDetails: Could not enrich details for ${mediaType} ID ${itemId}`, e);
    }
    
    return item;
}

/**
 * Updates the watch position in the history when navigating to the watch page.
 * @param id The ID of the video.
 * @param type The type of the video ('movie', 'tv', or 'anime').
 * @param season The current season number (optional).
 * @param episode The current episode number (optional).
 * @param title The title of the video (optional).
 */
export function updateWatchPositionOnNavigate(id: string, type: 'movie' | 'tv' | 'anime', season?: number | null, episode?: number | null, title?: string) {
    if (isServer()) return;
    try {
        const currentHistory = getWatchHistory();
        const key = type === 'anime' && (season === undefined || season === null) && false
            ? `mal-${id}`
            : `tmdb-${id}`;

        const existing = currentHistory[key] || {};
        const updated = {
            ...existing,
            id: existing.id || id,
            title: existing.title || title || '',
            type,
            last_season_watched: season != null ? String(season) : existing.last_season_watched,
            last_episode_watched: episode != null ? String(episode) : existing.last_episode_watched,
            last_updated: Date.now(),
        };
        currentHistory[key] = { ...existing, ...updated };
        localStorage.setItem(HISTORY_KEY, JSON.stringify(currentHistory));
        window.dispatchEvent(new CustomEvent('history-updated', { detail: currentHistory }));
    } catch (e) {
        console.error('updateWatchPositionOnNavigate error', e);
    }
}
