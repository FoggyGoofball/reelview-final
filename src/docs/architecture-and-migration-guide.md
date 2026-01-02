# ReelView: Architecture & Migration Guide for Node.js

This document provides a comprehensive overview of the ReelView application's architecture. Its primary purpose is to clarify the separation of concerns and data flow to assist in migrating the application to a Node.js backend environment.

## 1. Core Architectural Overview

**Key Takeaway:** The current version of ReelView is a **purely client-side application**. It does not have a traditional backend server, and it does not use Firebase. All "backend" logic and data storage currently happens directly within the user's web browser.

- **Framework:** Next.js with React (Client Components).
- **Styling:** Tailwind CSS with shadcn/ui components.
- **Primary Data Source:** [The Movie Database (TMDB)](https://www.themoviedb.org/) API.
- **Supplemental Data Source:** [Jikan (MyAnimeList)](https://jikan.moe/) API for anime enrichment.
- **"Database":** The browser's **`localStorage`**.

### Detailed Breakdown:

| Concern | Implementation | Key Files | Migration Advice |
| :--- | :--- | :--- | :--- |
| **Data Fetching** | All API calls to TMDB and Jikan are made directly from the client's browser. | `src/lib/tmdb.ts`, `src/lib/jikan.ts`, `src/lib/api.ts` | For a Node.js server, move these API calls from the client to your server. Create API endpoints on your Node server (e.g., `/api/search`, `/api/media/:id`) that will call TMDB/Jikan. This hides API keys and centralizes data logic. |
| **User Data Storage** | Watch History, Watchlist, and Dismissed Items are stored as JSON strings in the browser's `localStorage`. This is **not a real database**. | `src/lib/client-api.ts` (manages all `localStorage` reads/writes) | This is the most critical part to migrate. Replace all calls in `client-api.ts` with API calls to your new Node.js server. The Node server will then interact with a proper database (like PostgreSQL, MongoDB, or Firestore) to store user data. |
| **Authentication**| **None.** There is no user login system. All data in `localStorage` is anonymous and specific to a single browser. | N/A | Implement a full authentication system (e.g., using Passport.js, JWT, or Firebase Authentication) on the Node.js server. User-specific data in the database must be linked to a `userId`. |
| **State Management**| React Context is used to provide application-wide state for the Watchlist, Dismissed Items, and selected Player Source. | `src/context/*.tsx` | This logic can largely remain on the client-side. However, the `useEffect` hooks that initialize state from `localStorage` should be updated to fetch data from your new Node.js API endpoints after a user logs in. |

## 2. Step-by-Step Migration Strategy Advice

Here is a recommended path for migrating this client-side application to a proper client-server model with a Node.js backend.

### Step 1: Build the Node.js Server & API

1.  **Set up a basic Node.js server** using a framework like Express.js or Fastify.
2.  **Move API Key Management:** Store your TMDB and other API keys securely on the server as environment variables. Do not expose them to the client.
3.  **Create "Proxy" Endpoints:** For every function in `src/lib/api.ts` that calls TMDB or Jikan, create a corresponding API endpoint on your Node server.
    -   *Example:* The function `searchVideos(query)` in `src/lib/api.ts` should be replaced with a `fetch('/api/search?q=' + query)` call. Your Node.js server's `/api/search` endpoint will then be responsible for calling the TMDB API.
4.  **Refactor Client-Side Code:** Update the functions in `src/lib/api.ts` to call your new Node.js endpoints instead of calling TMDB/Jikan directly.

### Step 2: Implement Authentication & Database

1.  **Choose a Database:** Select a database for your Node.js server (e.g., Firestore, PostgreSQL, MongoDB).
2.  **Implement User Authentication:** Add sign-up, login, and logout endpoints to your Node server. Use a library like `Passport.js` and manage user sessions or JWTs.
3.  **Create Database Schemas:** Design tables/collections for `users`, `watchlist_items`, `watch_history`, etc. Ensure that user-specific data is always associated with a `userId`.
4.  **Build CRUD Endpoints for User Data:** Create API endpoints on your Node server for all the functions currently in `src/lib/client-api.ts`.
    -   *Example:* The function `addToWatchlist(video)` should be changed to make a `POST` request to a `/api/watchlist` endpoint on your server. The server would then verify the user is logged in and add the item to the database for that user.

### Step 3: Update the Next.js Client

1.  **Introduce an Authentication Context:** Create a new React context to manage the user's authentication state (e.g., `useAuth`). This will hold the user's profile and JWT token.
2.  **Create Login/Register Pages:** Build the UI components for user sign-up and login.
3.  **Protect Routes/Features:** Wrap components and pages that require user data (like Watchlist and History) in a check that verifies the user is logged in.
4.  **Replace `localStorage` with API Calls:** Update all the React Context providers (`WatchlistProvider`, `DismissedProvider`, etc.) in `src/context/` to fetch their initial state from your new Node.js API endpoints instead of from `localStorage`.

By following this guide, your other AI should have a clear understanding that the current app has **no server-side logic** and that its primary task is to **create a new Node.js server** and then refactor the client-side application to communicate with that server instead of with `localStorage` and external APIs.