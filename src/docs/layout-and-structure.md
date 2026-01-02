# ReelView: Layout & Structure Guide

This document provides precise, technical details about the layout, sizing, and positioning of the core UI components in the ReelView application. It is intended as a blueprint for developers recreating the UI in another framework, such as C#.

## 1. Overall Page Structure (`src/app/layout.tsx`)

The application uses a standard Next.js layout structure.

-   **Root Element:** The `<html>` tag has the class `dark` applied, enforcing the dark theme across the entire application.
-   **Font:** The `Inter` font is loaded from Google Fonts and applied to the `<body>`.
-   **Main Container:** All page content is wrapped within a `<main>` tag, which is itself a child of the `ClientLayout` component.

## 2. Header (`src/components/layout/header.tsx`)

The header is the most complex layout component.

-   **Tag:** `<header>`
-   **Positioning & Z-Index:**
    -   It is fixed to the top of the viewport using `sticky top-0`.
    -   A high `z-index` of `z-50` ensures it stays above all other page content.
-   **Sizing:**
    -   It has a fixed height of `h-16` (4rem or 64px).
-   **Styling:**
    -   The background is semi-transparent and blurred: `bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`. This creates a modern, layered feel.
    -   A `border-b border-border/40` provides a subtle visual separation from the content below.
-   **Internal Layout:**
    -   A `div` with class `container flex h-16 max-w-screen-2xl items-center` acts as the main content wrapper within the header. This centers the content and caps its maximum width.

### 2.1. Header Components

#### Logo (`src/components/layout/logo.tsx`)

-   **Position:** Left-aligned within the header's container.
-   **Structure:** An `<a>` tag wrapping an icon and text.
-   **Icon:** The `Film` icon from `lucide-react`.
    -   **Size:** `h-7 w-7` (1.75rem or 28px).
    -   **Color:** `text-primary`.
-   **Text:** "ReelView"
    -   **Visibility:** The text is hidden on small screens and appears on screens `sm` (640px) and wider using `hidden sm:inline-block`.
    -   **Styling:** `text-xl font-bold`.

#### Main Navigation & Search (`div` with `ml-auto`)

This container holds everything to the right of the logo.

-   **Desktop Navigation (`src/components/layout/main-nav.tsx`):**
    -   **Visibility:** Hidden by default and becomes a flex container on screens `md` (768px) and wider: `hidden md:flex`.
    -   **Structure:** A `<nav>` element containing a series of `<a>` tags.
    -   **Spacing:** Links have a horizontal gap of `space-x-4 lg:space-x-6`.
    -   **Link Styling:** `text-sm font-medium`. The active link (based on the current URL path) has the class `text-primary`.
-   **Source Selector (`src/components/layout/source-selector.tsx`):**
    -   **Visibility:** Also hidden on small screens and appears on `md` screens and wider, next to the main navigation.
-   **Search Input (`src/components/search/search-input.tsx`):**
    -   **Position:** Takes up the remaining space on the right using `flex-1 justify-end`.
    -   **Structure:** A `<form>` containing an `<input>`.
    -   **Sizing:** `relative w-full max-w-xs` (maximum width of 20rem or 320px).
    -   **Icon:** A `Search` icon is absolutely positioned inside the input on the left (`absolute left-3`).
    -   **Input Padding:** The input has left padding `pl-9` to prevent text from overlapping the icon.

#### Mobile Navigation (`src/components/layout/mobile-nav.tsx`)

-   **Visibility:** This component is only visible on screens smaller than `md` (768px) using `md:hidden`.
-   **Trigger Button:**
    -   A `<button>` with a `Menu` icon (`h-6 w-6`).
    -   It is an icon-only button (`size="icon"`).
-   **Sheet / Drawer:**
    -   When the trigger is clicked, a "sheet" component slides in from the left (`side="left"`).
    -   **Sizing:** It takes up `w-3/4` (75% of the viewport width) on mobile, with a maximum width of `sm:max-w-sm` (24rem or 384px).
    -   **Structure:**
        -   **Header:** Contains the `Logo` component again.
        -   **Content:** Contains the `MainNav` component, but with modified styles for a vertical layout (`flex-col items-start space-x-0 space-y-4`). The links inside are also larger (`text-lg`).
