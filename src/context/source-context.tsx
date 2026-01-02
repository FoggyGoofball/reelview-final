'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { VideoSource } from '@/lib/data';

const SOURCE_KEY = 'crimson-stream-source';
const VALID_SOURCES: VideoSource[] = ['default', 'vidsrc', 'godrive', 'mostream'];

interface SourceContextType {
  source: VideoSource;
  setSource: (source: VideoSource) => void;
  sources: VideoSource[];
}

const SourceContext = createContext<SourceContextType | undefined>(undefined);

export function SourceProvider({ children }: { children: React.ReactNode }) {
  const [source, setSourceState] = useState<VideoSource>('default');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    try {
      let initialSource: VideoSource;
      const storedSource = localStorage.getItem(SOURCE_KEY) as VideoSource;
      if (storedSource && VALID_SOURCES.includes(storedSource)) {
        initialSource = storedSource;
      } else {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        initialSource = isMobile ? 'vidsrc' : 'default';
      }
      setSourceState(initialSource);
    } catch (error) {
      console.error("Failed to read source from localStorage/navigator", error);
      setSourceState('default');
    }
    setIsInitialized(true);
  }, [isInitialized]);

  const setSource = useCallback((newSource: VideoSource) => {
    if (!VALID_SOURCES.includes(newSource)) {
        console.warn(`Invalid source selected: ${newSource}`);
        return;
    }
    try {
      localStorage.setItem(SOURCE_KEY, newSource);
      setSourceState(newSource);
      window.dispatchEvent(new CustomEvent('source-updated', { detail: newSource }));
    } catch (error) {
      console.error("Failed to save source to localStorage", error);
    }
  }, []);
  
  return (
    <SourceContext.Provider value={{ source, setSource, sources: VALID_SOURCES }}>
      {children}
    </SourceContext.Provider>
  );
}

export function useSource() {
  const context = useContext(SourceContext);
  if (context === undefined) {
    throw new Error('useSource must be used within a SourceProvider');
  }
  return context;
}
