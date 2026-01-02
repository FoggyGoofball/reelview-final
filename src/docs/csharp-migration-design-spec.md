# ReelView C# Migration: Design & Architecture Specification

This document provides a comprehensive blueprint for developers recreating the ReelView web application in a C# environment (e.g., Avalonia, MAUI). It details the UI layout, component behavior, data flow, and content filtering logic necessary to replicate the user experience.

## 1. Core Architectural Principles

The application is a **purely client-side application**. All "backend" logic and data storage happens within the user's browser.

-   **Primary Data Source:** The Movie Database (TMDB) API.
-   **Supplemental Data Source:** Jikan (MyAnimeList) API for anime-specific details.
-   **User Data Storage:** The browser's `localStorage` is used as a simple key-value database for:
    -   Watch History (`vidLinkProgress`)
    -   Watchlist (`vidLinkWatchlist`)
    -   Dismissed Items (`vidLinkDismissed`)
    -   Custom Episode/Season Overrides (`vidLinkCustomData`)

## 2. Header and Navigation Design

The header is a `sticky` element that remains at the top of the viewport. It has a semi-transparent, blurred background to create a modern, layered look.

### 2.1. Structure (`src/components/layout/header.tsx`)

The header contains three main sections arranged horizontally:

1.  **Logo (Left-aligned):** `Film` icon and "ReelView" text. Links to the homepage (`/`).
2.  **Main Navigation (Center, on Desktop):** A set of links to the primary pages.
3.  **Search & Mobile-Nav (Right-aligned):** The search input and the trigger for the mobile navigation menu.

### 2.2. Desktop Layout (Screens > 768px wide)

-   **Logo:** Icon and text are visible.
-   **Main Navigation (`src/components/layout/main-nav.tsx`):**
    -   A horizontal list of text links. The active link is highlighted with the primary color.
    -   **Links and Order:**
        1.  Home (`/`)
        2.  Movies (`/movies`)
        3.  TV Shows (`/tv`)
        4.  Anime (`/anime`)
        5.  Watchlist (`/watchlist`)
        6.  History (`/history`)
-   **Source Selector (`src/components/layout/source-selector.tsx`):** A dropdown menu allowing the user to select the video player source (e.g., 'Default', 'VidSrc').
-   **Search Input (`src/components/search/search-input.tsx`):** A text input field for searching.

### 2.3. Mobile Layout (Screens < 768px wide)

-   The Main Navigation and Source Selector are hidden.
-   A "hamburger" menu icon (`<Menu>`) appears on the far right.
-   Tapping the icon opens a **Sheet/Drawer** that slides in from the left, containing the vertical list of navigation links and the source selector.

## 3. Search Functionality

-   **Trigger:** Submitting the search form in the header navigates the user to the `/search` page.
-   **Routing:** The search query is passed as a URL parameter: `/search?q=<your-query>`.
-   **Contextual Search:**
    -   If the search is initiated from the `/anime` page, an additional parameter is added: `/search?q=<your-query>&is_anime_search=true`.
    -   This `is_anime_search=true` flag tells the search logic to use a more specific TMDB endpoint tailored for finding anime.
-   **API Logic (`src/lib/api.ts` -> `searchVideos`):**
    -   **Standard Search:** Queries the TMDB `/search/multi` endpoint, which finds movies and TV shows. It fetches multiple pages and sorts the combined results by `popularity`.
    -   **Anime Search:** Queries the TMDB `/search/tv` endpoint but adds a `with_keywords` parameter for the "anime" keyword to narrow down results.

## 4. Custom Episodes/Seasons Editing (`src/components/video/edit-episodes-dialog.tsx`)

This feature allows users to manually correct the episode or season count for a TV show or anime if the API data is incorrect.

1.  **Trigger:** An "Edit" button on the media details page (`/media/[type]/[id]`) opens a dialog box.
2.  **UI:**
    -   For **Anime:** A single input field for "Total Episodes".
    -   For **TV Shows:** A dynamic list of fields where each entry has two inputs: "Season Number" and "Episode Count". Users can add or remove seasons.
3.  **Data Storage:**
    -   On saving, the data is stored in `localStorage` under the `vidLinkCustomData` key.
    -   The key for the specific show is a composite string: `${media.media_type}-${media.id}` (e.g., `tv-1399`).
    -   The value is a JSON object, e.g., `{ "seasons": [{"season_number": 1, "episode_count": 10}] }` or `{ "episodes": 24 }`.
4.  **Data Application:** When a media details page or watch page loads, it first fetches the standard data from the API and then checks `localStorage` for any custom overrides for that specific ID. If an override exists, it is applied to the data before rendering the UI.

## 5. Page Layouts & Carousel Order

### 5.1. Home Page (`/`)

This is the main discovery hub. The carousels appear in the following order, from top to bottom:

1.  **Featured Video:** A large hero component at the top, which rotates through a small, randomized pool of popular movies, TV shows, and anime.
2.  **Continue Watching:** Displays items from the user's watch history that are partially complete.
3.  **From Your Watchlist:** Displays items the user has added to their watchlist.
4.  **Popular Movies:** Fetches from TMDB's popular movies endpoint.
5.  **Popular TV Series:** Fetches from TMDB's popular TV shows endpoint.
6.  **Top Airing Anime:** Fetches recently aired and popular anime from TMDB.

### 5.2. Movies Page (`/movies`)

This page is dedicated to movie genres.

-   **Carousel Order:** Action, Comedy, Drama, Horror, Science Fiction, Thriller.
-   Each carousel title links to a dedicated genre page (e.g., `/movies/genre/28?name=Action`).

### 5.3. TV Shows Page (`/tv`)

This page is dedicated to live-action and Western-style animation. **It is explicitly curated to exclude anime.**

-   **Carousel Order:**
    1.  **Animation** (Family-friendly)
    2.  **Action & Adventure**
    3.  **Comedy**
    4.  **Crime**
    5.  **Documentary**
    6.  **Drama**
    7.  **Family**
    8.  **Sci-Fi & Fantasy**
    9.  **Adult Animation** (Last)
-   Each carousel title links to its genre page (e.g., `/tv/genre/10759?name=Action%20&%20Adventure`).

### 5.4. Anime Page (`/anime`)

This page is dedicated exclusively to anime.

-   **Carousel Order:** Action & Adventure, Drama, Sci-Fi & Fantasy, Shonen, Comedy.
-   Each carousel title links to its genre page (e.g., `/anime/genre/10759?name=Action%20&%20Adventure`).

## 6. Content Filtering & Classification Logic

This is the most complex part of the data logic. It ensures that content is correctly categorized and displayed in the right sections. The core logic resides in `src/lib/api.ts`.

### 6.1. Anime vs. TV Show Classification

A media item from TMDB is classified as `media_type: 'anime'` if and only if **all** of the following are true:
1.  Its TMDB `media_type` is `'tv'`.
2.  Its `genre_ids` array contains `16` (the ID for the "Animation" genre).
3.  Its `original_language` is one of `ja` (Japanese), `ko` (Korean), or `zh` (Chinese).

This check is performed in the `tmdbMediaToVideo` function, which is the central point for processing all media data.

### 6.2. TV Shows Page Filtering (`/tv/page.tsx`)

To ensure the TV Shows page feels distinct from the Anime page, a multi-step filtering process is used:

1.  **Standard Genre Fetching (Action, Comedy, etc.):**
    -   When fetching data for these carousels, the API call to TMDB's `/discover/tv` endpoint includes a `without_genres=16` parameter.
    -   This **proactively excludes all animated content** at the API level, ensuring these carousels only contain live-action shows.

2.  **Animation Genre Fetching:**
    -   A separate, broader fetch is made for content with the "Animation" genre (`with_genres=16`).
    -   This list is then processed **client-side**:
        -   Any item that meets the criteria for `media_type: 'anime'` (see 6.1) is **discarded**.
        -   The remaining shows (which are non-anime animations, like American or European cartoons) are split into two lists based on their content rating (`is_explicit` flag).
        -   The **"Animation"** carousel is populated with the non-explicit shows.
        -   The **"Adult Animation"** carousel is populated with the explicit shows.

This ensures a clean separation and prevents content from appearing in multiple, incorrect categories.
