'use client';

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function LoadingBar() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show loading bar on route change start
    setIsLoading(true);

    // Hide loading bar on route change complete
    const handleComplete = () => setIsLoading(false);
    
    // We use a short timeout to allow the new page to render before hiding the bar.
    const timer = setTimeout(handleComplete, 200);

    return () => {
      clearTimeout(timer);
      handleComplete();
    };
  }, [location.pathname]);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-50">
      <div className="h-full bg-primary animate-pulse" />
    </div>
  );
}
