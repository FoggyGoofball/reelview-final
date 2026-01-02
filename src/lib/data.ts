export type Video = {
  id: string;
  title: string;
  name?: string; // To handle cases where TV shows use 'name' and movies use 'title'
  description: string;
  categories: string[];
  thumbnailSeed: string; // For hero images
  poster_path: string;   // For card images
  media_type: 'movie' | 'tv' | 'anime';
  
  // Optional fields
  season?: number;
  episode?: number;
  vote_average?: number;
  release_date?: string;
  original_language?: string;
  genre_ids?: number[];
  keywords?: { id: number, name: string }[];
  is_explicit?: boolean;
  runtime?: number; // Added runtime in minutes
  
  // For anime
  mal_id?: number;
  episodes?: number;
  status?: string; // e.g., 'Finished Airing', 'Currently Airing'
  rating?: string; // e.g., 'PG-13 - Teens 13 or older'

  // For TV
  seasons?: { season_number: number, episode_count: number, name?: string }[];
  external_ids?: {
    imdb_id: string | null;
    tvdb_id: number | null;
    myanimelist_id: number | null;
  };
};

export type Category = {
  id:string;
  name: string;
  is_keyword?: boolean;
};

// This data is now fetched from APIs, but we keep the structure definitions
// and this file for reference. The exported arrays are now empty.

export const categories: Category[] = [];

export const videos: Video[] = [];

export interface WatchProgress {
  id: string; 
  type: 'movie' | 'tv' | 'anime';
  title: string;
  poster_path: string;
  progress: {
    watched: number;
    duration: number;
  };
  last_season_watched?: string;
  last_episode_watched?: string;
  show_progress?: {
    [key: string]: {
      season: string;
      episode: string;
      progress: {
        watched: number;
        duration: number;
      };
    };
  };
  last_updated: number;
  mal_id?: number;
  rating?: string;
  
  // Enriched fields
  seasons?: { season_number: number, episode_count: number, name?: string }[];
  episodes?: number;
}

export type CustomVideoData = {
  episodes?: number;
  seasons?: { season_number: number, episode_count: number }[];
}

export type VideoSource = 'default' | 'vidsrc' | 'godrive' | 'mostream';

export const EXPLICIT_RATINGS = [
  // MPAA Movie Ratings (US)
  'R',
  'NC-17',
  
  // TV Ratings
  'TV-MA',
  'TV-14',  // Can contain strong sexual dialogue/content
  
  // Anime/MyAnimeList Ratings
  'R - 17+',
  'R+',
  'MA',           // MyAnimeList Mature Audiences
  'Rx',           // Explicit/Ecchi
  'Hentai',       // Pornographic anime
  
  // Generic Adult/Restricted Ratings
  'Adult',
  'Restricted',
  'RESTRICTED',
  
  // Age-based Ratings
  '17+',
  '17 Plus',
  'Rated 17',
  '18',
  '18+',
  '18 Plus',
  'Rated 18',
  '21+',
  'Adults Only',
  
  // International Variants
  'M/PG',         // Australian/NZ
  'M',            // Some regions
  'UA',           // Indian rating (but can have adult content)
];
