
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpandableTextProps {
  text: string;
  className?: string;
  charLimit?: number;
}

export function ExpandableText({ text, className, charLimit = 200 }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (text.length <= charLimit) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{text}</p>;
  }

  const toggleExpansion = () => setIsExpanded(!isExpanded);

  return (
    <div className={cn('text-sm text-muted-foreground', className)}>
      <p>
        {isExpanded ? text : `${text.substring(0, charLimit)}...`}
      </p>
      <Button
        variant="link"
        className="p-0 h-auto text-primary hover:underline"
        onClick={toggleExpansion}
      >
        {isExpanded ? 'Read Less' : 'Read More'}
      </Button>
    </div>
  );
}
