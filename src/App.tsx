import React, { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ApiKeyDialogProvider } from '@/context/api-key-dialog-context';
import { ApiKeyNotice } from '@/components/api-key-notice';

// Global error handler - catch EVERYTHING
window.addEventListener('error', (event) => {
  const msg = `[GLOBAL ERROR] ${event.error?.toString()}\nStack: ${event.error?.stack}`
  console.error('[GLOBAL ERROR]', msg)
})

window.addEventListener('unhandledrejection', (event) => {
  const msg = `[UNHANDLED REJECTION] ${event.reason?.toString()}`
  console.error('[UNHANDLED REJECTION]', msg)
})

// Comprehensive error boundary with detailed logging
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props)
    this.state = { hasError: false, error: null }
    console.log('[ERROR BOUNDARY] Constructor initialized')
  }

  static getDerivedStateFromError(error: any) {
    const errorMsg = error?.toString()
    const errorStack = error?.stack
    console.error('[ERROR BOUNDARY] ? getDerivedStateFromError caught:', errorMsg)
    console.error('[ERROR BOUNDARY] Stack:', errorStack)
    console.log('[ERROR BOUNDARY] ERROR MESSAGE:', errorMsg)
    console.log('[ERROR BOUNDARY] ERROR STACK:', errorStack)
    
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    const errorMsg = error?.toString()
    const errorStack = error?.stack
    const componentStack = errorInfo?.componentStack
    
    console.error('[ERROR BOUNDARY componentDidCatch] ? Error:', errorMsg)
    console.error('[ERROR BOUNDARY] Stack:', errorStack)
    console.error('[ERROR BOUNDARY] Component Stack:', componentStack)
    console.log('[ERROR BOUNDARY componentDidCatch] MESSAGE:', errorMsg)
    console.log('[ERROR BOUNDARY componentDidCatch] COMPONENT STACK:', componentStack)
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString()
      const errorStack = this.state.error?.stack
      
      console.error('[ERROR BOUNDARY RENDER ERROR UI] Error:', errorMsg)
      console.log('[ERROR BOUNDARY RENDER ERROR UI] MESSAGE:', errorMsg)
      console.log('[ERROR BOUNDARY RENDER ERROR UI] STACK:', errorStack)
      
      return (
        <div style={{ padding: '20px', color: '#ff0000', fontFamily: 'monospace', backgroundColor: '#000', minHeight: '100vh', overflowY: 'auto', fontSize: '12px' }}>
          <h1>?? React Error Caught by ErrorBoundary</h1>
          <h2>Error Message:</h2>
          <pre style={{ backgroundColor: '#111', padding: '10px', overflow: 'auto', color: '#ff6b6b', maxHeight: '300px' }}>
            {errorMsg}
          </pre>
          <h2>Error Stack:</h2>
          <pre style={{ backgroundColor: '#111', padding: '10px', overflow: 'auto', color: '#0f0', maxHeight: '300px' }}>
            {errorStack}
          </pre>
          <h2 style={{ color: '#ffff00' }}>Check Terminal/Console for Full Diagnostic Information</h2>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', marginTop: '20px', backgroundColor: '#ff0000', color: '#fff' }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Import layout and context providers
import { Header } from '@/components/layout/header'
import { Toaster } from '@/components/ui/toaster'
import { WatchlistProvider } from '@/context/watchlist-context'
import { DismissedProvider } from '@/context/dismissed-context'
import { SourceProvider } from '@/context/source-context'
import { LoadingBar } from '@/components/layout/loading-bar'

console.log('[APP] Importing page components...')

// Import all page components from pages/ (Vite-native)
import Home from './pages/Home'
import Movies from './pages/Movies'
import TV from './pages/TV'
import Anime from './pages/Anime'
import Watch from './pages/Watch'
import Search from './pages/Search'
import Watchlist from './pages/Watchlist'
import History from './pages/History'
import Media from './pages/Media'
import Downloads from './pages/Downloads'
import MovieGenre from './pages/MovieGenre';
import TvGenre from './pages/TvGenre';
import AnimeGenre from './pages/AnimeGenre';

console.log('[APP] ? All page components imported successfully')
console.log('[APP] Starting ReelView initialization...')

// Detect platform
const isElectron = typeof window !== 'undefined' && !!(window as any).electronDownload

console.log('[APP] Platform detection: isElectron =', isElectron)

function ClientLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch')

  console.log('[LAYOUT] Rendering ClientLayout, path:', location.pathname)

  try {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <SourceProvider>
          <DismissedProvider>
            <WatchlistProvider>
              <Suspense fallback={null}>
                <LoadingBar />
              </Suspense>
              {/* Hide main Header on watch page - WatchHeader will provide its own controls */}
              {!isWatchPage && <Header />}
              <main>{children}</main>
              <Toaster />
            </WatchlistProvider>
          </DismissedProvider>
        </SourceProvider>
      </Suspense>
    )
  } catch (error) {
    console.error('[LAYOUT] ? Error rendering ClientLayout:', error)
    throw error
  }
}

function AppRoutes() {
  const location = useLocation()

  console.log('[ROUTES] Current route:', location.pathname)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  try {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/tv" element={<TV />} />
        <Route path="/anime" element={<Anime />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/search" element={<Search />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/history" element={<History />} />
        <Route path="/media/:media_type/:id" element={<Media />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/movies/genre" element={<MovieGenre />} />
        <Route path="/tv/genre" element={<TvGenre />} />
        <Route path="/anime/genre" element={<AnimeGenre />} />
        <Route path="*" element={<Home />} />
      </Routes>
    )
  } catch (error) {
    console.error('[ROUTES] ? Error rendering routes:', error)
    throw error
  }
}

export default function App() {
  console.log('[APP] Rendering App component')

  useEffect(() => {
    console.log('[APP] React mounted')
  }, [])

  try {
    return (
      <ApiKeyDialogProvider>
        <ErrorBoundary>
          <BrowserRouter basename="/">
            <ClientLayout>
              <AppRoutes />
              <ApiKeyNotice />
            </ClientLayout>
          </BrowserRouter>
        </ErrorBoundary>
      </ApiKeyDialogProvider>
    )
  } catch (error) {
    console.error('[APP] ? Error rendering App:', error)
    throw error
  }
}
