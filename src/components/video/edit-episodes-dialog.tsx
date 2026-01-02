'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import type { Video, CustomVideoData } from '@/lib/data';
import { saveCustomVideoData } from '@/lib/client-api';
import { Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface EditEpisodesDialogProps {
  video: Video;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataSaved: (data: CustomVideoData) => void;
}

type FormValues = {
  episodes?: number;
  seasons?: {
    season_number: number;
    episode_count: number;
  }[];
};

export function EditEpisodesDialog({
  video,
  isOpen,
  onOpenChange,
  onDataSaved,
}: EditEpisodesDialogProps) {
  const isAnime = video.media_type === 'anime';

  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      episodes: video.episodes,
      seasons: video.seasons?.filter(s => s.season_number > 0),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'seasons',
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        episodes: video.episodes || 0,
        seasons: video.seasons?.filter(s => s.season_number > 0) || [{season_number: 1, episode_count: 0}],
      });
    }
  }, [isOpen, video, reset]);

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    const videoKey = `${video.media_type}-${video.id}`;
    
    const savedData: CustomVideoData = isAnime 
      ? { episodes: Number(data.episodes) }
      : { seasons: data.seasons?.map(s => ({...s, season_number: Number(s.season_number), episode_count: Number(s.episode_count)})) };
      
    saveCustomVideoData(videoKey, savedData);
    onDataSaved(savedData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Episodes for {video.title}</DialogTitle>
          <DialogDescription>
            Manually override the season and episode data for this title.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 py-4">
                {isAnime ? (
                    <div className="space-y-2">
                    <Label htmlFor="episodes">Total Episodes</Label>
                    <Input
                        id="episodes"
                        type="number"
                        {...register('episodes', { valueAsNumber: true })}
                    />
                    </div>
                ) : (
                    <div className='space-y-4'>
                        {fields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-2 p-3 border rounded-md">
                            <div className="flex-1 space-y-2">
                                <Label>Season {index + 1}</Label>
                                <div className='flex gap-2'>
                                    <Input
                                        type="number"
                                        placeholder="Season No."
                                        {...register(`seasons.${index}.season_number`, { valueAsNumber: true, required: true })}
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Episode Count"
                                        {...register(`seasons.${index}.episode_count`, { valueAsNumber: true, required: true })}
                                    />
                                </div>
                            </div>
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        ))}
                         <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({ season_number: (fields.length > 0 ? Math.max(...fields.map(f => f.season_number)) : 0) + 1, episode_count: 0 })}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Season
                        </Button>
                    </div>
                )}
                </div>
           </ScrollArea>
           <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Changes</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
