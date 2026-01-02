import { useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';

export function Logo() {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate('/')}
      className="flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer hover:opacity-80 transition-opacity"
      aria-label="ReelView Home"
    >
      <Film className="h-7 w-7 text-primary" />
      <span className="hidden text-xl font-bold tracking-tighter text-foreground sm:inline-block">
        ReelView
      </span>
    </button>
  );
}
