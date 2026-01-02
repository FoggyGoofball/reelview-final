

'use client';

import { useSource } from '@/context/source-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '../ui/button';
import { ChevronDown, Database } from 'lucide-react';
import { buttonVariants } from '../ui/button';
import { cn } from '@/lib/utils';
import type { VariantProps } from 'class-variance-authority';

interface SourceSelectorProps {
    buttonVariant?: VariantProps<typeof buttonVariants>["variant"];
    className?: string;
}

const sourceLabels: Record<string, string> = {
  default: 'Default',
  vidsrc: 'VidSrc',
  godrive: 'GoDrive (Ads)',
  mostream: 'MoStream (Anime)',
};

export function SourceSelector({ buttonVariant, className }: SourceSelectorProps) {
  const { source, setSource, sources } = useSource();

  return (
     <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant={buttonVariant || "outline"} className={cn('capitalize', className)}>
                <Database className='mr-2 h-4 w-4' />
                {sourceLabels[source] || source}
                <ChevronDown className='ml-2 h-4 w-4' />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            <DropdownMenuRadioGroup value={source} onValueChange={(value) => setSource(value as any)}>
                {sources.map(s => (
                     <DropdownMenuRadioItem key={s} value={s} className='capitalize'>
                        {sourceLabels[s] || s}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}
