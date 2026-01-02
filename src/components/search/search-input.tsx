'use client';

import { useNavigate, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import React from 'react';

export function SearchInput() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse query from URL
  const params = new URLSearchParams(location.search);
  const defaultQuery = params.get('q') || '';

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('search') as string;
    
    let searchUrl = '/search';
    if (query) {
      searchUrl += `?q=${encodeURIComponent(query)}`;
      if (location.pathname === '/anime') {
        searchUrl += `&is_anime_search=true`;
      }
    }
    navigate(searchUrl);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="search"
        defaultValue={defaultQuery}
        placeholder="Search titles..."
        className="w-full bg-secondary pl-9"
        aria-label="Search for a video"
      />
    </form>
  );
}
