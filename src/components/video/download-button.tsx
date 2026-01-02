import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable, getPlatform } from '@/lib/unified-download';

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
}

export function DownloadButton({ suggestedFilename }: { suggestedFilename?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    setMessage('Starting...');

    try {
      const platform = getPlatform();
      setMessage(`Platform: ${platform}`);

      if (!isDownloadAvailable()) {
        setMessage('Downloads not available on this platform');
        setIsLoading(false);
        return;
      }

      const api = getDownloadAPI();

      if (typeof api?.getCapturedStreams !== 'function') {
        setMessage('No getCapturedStreams method');
        setIsLoading(false);
        return;
      }

      let streams = await api.getCapturedStreams!();

      if ((!streams || streams.length === 0)) {
        for (let i = 0; i < 3; i++) {
          await new Promise(res => setTimeout(res, 500));
          try {
            const retry = await api.getCapturedStreams!();
            if (retry && retry.length > 0) { streams = retry; break; }
          } catch { }
        }
      }

      if ((!streams || streams.length === 0)) {
        setMessage('No streams captured - play the video first');
        setIsLoading(false);
        return;
      }

      const sourceList = (streams && streams.length > 0) ? streams : [];
      const raw = sourceList[0];
      const url = typeof raw === 'string' ? raw : raw?.url;

      if (!url) {
        setMessage('Could not determine a stream URL');
        setIsLoading(false);
        return;
      }

      // Derive suggested filename if not provided
      let suggestedName = suggestedFilename || `video_${Date.now()}`;
      if (!suggestedFilename) {
        try {
          const win = window as any;
          const currentLocation = win?.location?.href || '';
          const params = new URLSearchParams(currentLocation.split('?')[1] || '');
          const id = params.get('id');
          const type = params.get('type');
          const s = params.get('s');
          const e = params.get('e');
          if (type && id && (type === 'tv' || type === 'anime') && s && e) {
            const titleEl = document.querySelector('h1') || document.querySelector('title');
            const titleText = (titleEl?.textContent || '').trim() || `series_${id}`;
            const sP = String(s).padStart(2, '0');
            const eP = String(e).padStart(2, '0');
            suggestedName = `${titleText}_S${sP}E${eP}`;
          } else {
            // try document.title or h1
            const titleEl = document.querySelector('h1') || document.querySelector('title');
            const titleText = (titleEl?.textContent || '').trim();
            if (titleText) suggestedName = titleText;
          }
        } catch (ex) {}
      }

      suggestedName = sanitizeFilename(suggestedName);

      const result = await api.startDownload(url, suggestedName);

      setMessage(result?.success ? 'Download started!' : `Error: ${result?.error || 'unknown'}`);
    } catch (e: any) {
      setMessage(`Error: ${e?.message || e}`);
    } finally {
      setIsLoading(false);
    }
  }, [suggestedFilename]);

  if (!isDownloadAvailable()) return null;

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant="ghost"
      size="icon"
      className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20 flex-shrink-0"
      title={`Download (${getPlatform()})`}
    >
      {isLoading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Download className="h-3 w-3 sm:h-4 sm:w-4" />}
    </Button>
  );
}
