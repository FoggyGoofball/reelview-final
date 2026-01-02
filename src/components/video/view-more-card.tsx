'use client';

import { Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export interface ViewMoreCardProps {
  href: string;
}

export function ViewMoreCard({ href }: ViewMoreCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (href) {
      navigate(href);
    } else {
      navigate('/');
    }
  };

  return (
    <Card className="group relative overflow-hidden rounded-lg bg-muted cursor-pointer transition-all hover:shadow-xl hover:scale-105" onClick={handleClick}>
      <CardContent className="p-0 relative h-full w-full aspect-[2/3] flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
        <div className="text-center">
          <Play className="h-12 w-12 text-primary mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">View More</p>
        </div>
      </CardContent>
    </Card>
  );
}
