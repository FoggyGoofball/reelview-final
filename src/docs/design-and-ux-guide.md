# ReelView: Design & User Experience Guide

This document provides a comprehensive guide to the visual design, component architecture, and user experience (UX) principles of the ReelView application. It is intended to assist developers in recreating the look and feel of the app on other platforms, such as a C# desktop application.

## 1. Core Design Philosophy

The aesthetic of ReelView is designed to be **cinematic, immersive, and content-focused**. The UI should feel modern, clean, and intuitive, directing the user's attention to the movie and TV show posters.

-   **Theme:** Dark, with high-contrast elements to make images and key actions pop.
-   **Spacing:** Generous use of padding and margins to create a breathable, uncluttered layout.
-   **Imagery:** The application relies heavily on high-quality poster and backdrop images. All UI elements are designed to support and frame this visual content.
-   **Interactivity:** Interactions are designed to be smooth and responsive, with clear visual feedback (hover effects, transitions) that feels satisfying.

## 2. Visual Language

### 2.1. Color Palette

The color scheme is defined using HSL values in `src/app/globals.css`, allowing for easy theming. The dark theme is the default and only theme.

-   **Background (`--background`):** A very dark gray (`hsl(0 0% 13%)`), almost black, to provide a cinematic, low-light feel.
-   **Foreground (`--foreground`):** A soft off-white (`hsl(0 0% 96%)`) for primary text, ensuring readability without being harsh.
-   **Primary (`--primary`):** A strong, vibrant blue (`hsl(0 74% 42%)`) used for calls-to-action, active navigation links, focus rings, and key highlights. It serves as the main branding color.
-   **Secondary / Muted (`--secondary`, `--muted`):** A medium-dark gray (`hsl(0 0% 20%)`) used for card backgrounds, input fields, and less important UI elements. It provides a subtle separation from the main background.
-   **Borders (`--border`):** A slightly lighter gray (`hsl(0 0% 25%)`) than the secondary color, used for subtle divisions and outlines.
-   **Destructive (`--destructive`):** A deep red (`hsl(0 62.8% 30.6%)`) used for error states and destructive actions, like in alert dialogs.

### 2.2. Typography

-   **Primary Font:** `Inter` is used for all UI text, including headlines and body copy. It's a clean, highly readable sans-serif font that works well at various sizes.
-   **Hierarchy:**
    -   **Page Titles (H1):** Large and bold (e.g., `text-3xl`, `text-4xl`, `font-bold`).
    -   **Carousel Titles (H2):** Smaller but still bold (e.g., `text-2xl`, `font-bold`).
    -   **Card Titles (H3):** Small and medium-weight (`text-sm`, `font-medium`).
    -   **Body/Description Text:** Regular weight with a slightly muted color (`text-muted-foreground`) to de-emphasize it against titles.

### 2.3. Sizing and Spacing

-   **Layout:** The main content resides within a responsive container (`max-w-screen-2xl`) with horizontal padding.
-   **Radius:** A consistent border-radius (`--radius: 0.5rem`) is used on cards, buttons, and inputs for a soft, modern look.
-   **Grid:** A responsive grid (`grid-cols-2` up to `xl:grid-cols-6`) is used for displaying video cards on genre and search pages, ensuring the layout adapts to different screen sizes.

## 3. Key Component Designs

### 3.1. Header & Navigation Bar

-   **Behavior:** The header is `sticky` to the top of the viewport, ensuring navigation is always accessible.
-   **Appearance:** It has a semi-transparent background with a `backdrop-blur` effect. This allows content scrolling underneath to be subtly visible, adding a sense of depth. A bottom border provides a clean separation from the page content.
-   **Components:**
    -   **Logo:** A primary-colored icon paired with the app name in a bold font.
    -   **Main Navigation:** A horizontal list of text links. The active page's link is colored with the `primary` color, while others are a muted foreground color. On hover, links transition to the primary color.
    -   **Search Input:** A right-aligned search bar with a muted background and a subtle icon inside.
    -   **Mobile Navigation:** On smaller screens, the main nav is hidden and replaced with a "hamburger" menu icon. Tapping it opens a slide-in "sheet" from the left, containing the vertical navigation links.

### 3.2. Carousel Design

The carousel is the primary component for browsing content.

-   **Structure:** A horizontal, scrollable container. It does not use visible scrollbars; scrolling is achieved via mouse wheel, trackpad, or touch.
-   **Title:** Each carousel has a bold title that also serves as a link to a dedicated "View More" page for that category. It includes a chevron icon that animates on hover to indicate interactivity.
-   **Items (`VideoCard`):** The core of the carousel is a list of `VideoCard` components.
-   **"View More" Card:** If a category has more items than are displayed, the last item in the carousel is a special `ViewMoreCard`. This card has a dashed border and a "plus" icon, clearly inviting the user to see all items in that category.

### 3.3. Video Card Interaction (The "Magic" UX)

The `VideoCard` is the most interactive and important component. Its design is crucial to the user experience.

-   **Resting State:** A simple poster image with an aspect ratio of 2:3. The title is displayed cleanly below the card.
-   **Hover State (The Core UX):** This is where the card comes alive.
    1.  **Scale & Shadow:** The entire card smoothly scales up slightly (`group-hover:scale-105`) and gains a prominent shadow, lifting it off the page. This provides immediate, satisfying feedback.
    2.  **Border:** A colored border (`group-hover:border-primary`) appears around the card, reinforcing the selection.
    3.  **Action Buttons Appear:** Crucially, the action buttons (Play, Add to Watchlist, Dismiss) are **hidden by default**. They fade into view (`md:opacity-0 group-hover:opacity-100`) on the top right of the poster only on hover. This keeps the browsing experience clean and uncluttered, revealing actions only when the user shows intent.
    4.  **Button Appearance:** The action buttons are icon-only and have a semi-transparent dark background, ensuring they are visible against any poster image. On hover, they have their own feedback (e.g., `hover:bg-white/20`).

## 4. General User Experience

-   **Content Discovery:** The homepage is designed for discovery, featuring a large, rotating hero image for featured content, followed by curated carousels (Continue Watching, Watchlist, Popular).
-   **Feedback:**
    -   **Loading States:** Skeletons are used extensively. When carousels or pages are loading data, gray, pulsating placeholder shapes (`<Skeleton>`) mimic the final layout. This prevents layout shifts and informs the user that content is on its way.
    -   **Toasts:** Small, non-intrusive "toast" notifications appear at the bottom of the screen to confirm actions like adding to a watchlist or to report errors.
-   **Lobby Page (`/media/[id]`):**
    -   Uses a dominant hero image (backdrop) with a gradient overlay to ensure text readability.
    -   The poster image is positioned to overlap the hero image, creating a sense of depth.
    -   Primary actions ("Play," "Add to Watchlist") are large and immediately visible.
-   **Watch Page:** The watch page is designed for maximum immersion. The UI is minimal, consisting of a full-screen video player and an overlaid, semi-transparent header that provides essential controls (back, next/previous episode, source selection) without obstructing the view.

## 5. Content Curation: Filtering & Carousel Order

The application uses specific rules to categorize content, which directly impacts what the user sees on pages like "TV Shows" and "Anime".

### 5.1. Anime vs. TV Show Classification

A show is classified as `media_type: 'anime'` if it meets the following criteria from the TMDB API:
1.  Its `media_type` is `'tv'`.
2.  Its `genre_ids` array contains `16` (the ID for "Animation").
3.  Its `original_language` is one of `ja` (Japanese), `ko` (Korean), or `zh` (Chinese).

This classification happens in the `tmdbMediaToVideo` function and is fundamental to the app's content separation.

### 5.2. Filtering on the TV Shows Page (`/tv`)

The TV Shows page is carefully curated to prevent anime and general animated content from mixing with live-action genres.

-   **Carousel Order:**
    1.  **Animation:** The first carousel.
    2.  **Standard Live-Action Genres:** (Action & Adventure, Comedy, Crime, etc.)
    3.  **Adult Animation:** The last carousel.

-   **Filtering Logic:**
    -   **Standard Genres (Action, Comedy, etc.):** When fetching data for these carousels, the API call explicitly *excludes* any show with the "Animation" genre ID (16). This ensures these carousels contain only live-action content.
    -   **Animation Genres:** The app makes a broad request for all shows with the "Animation" genre ID. It then processes this list:
        -   Shows classified as `media_type: 'anime'` are **completely filtered out**.
        -   Remaining shows are separated into two lists based on the `is_explicit` flag (derived from the content rating, e.g., "TV-MA").
        -   The "Animation" carousel is populated with the non-explicit shows.
        -   The "Adult Animation" carousel is populated with the explicit shows.

This ensures a clean, logical separation of content that aligns with user expectations for the "TV Shows" section.