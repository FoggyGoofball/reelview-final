'use client';

import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MainNavProps extends React.HTMLAttributes<HTMLElement> {
    isInSheet?: boolean;
}

export function MainNav({ className, isInSheet, ...props }: MainNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/movies', label: 'Movies' },
    { href: '/tv', label: 'TV Shows' },
    { href: '/anime', label: 'Anime' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/history', label: 'History' },
    { href: '/downloads', label: 'Downloads' }, // added downloads link
  ];
  
  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };
  
  const NavLink = ({ href, label }: { href: string, label: string }) => (
    <button
      onClick={() => navigate(href)}
      className={cn(
        'text-sm font-medium transition-colors cursor-pointer bg-transparent border-none p-0',
        isInSheet ? 'block py-2 text-lg' : '',
        isActive(href) ? 'text-red-500 font-bold hover:text-red-600' : 'text-foreground/80 hover:text-primary'
      )}
    >
      {label}
    </button>
  );

  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      {navItems.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  );
}
