'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tv, Loader2 } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable, getPlatform } from '@/lib/unified-download';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CastButtonProps {
  videoTitle?: string;
  posterUrl?: string;
}

function getChromecastPlugin() {
  const cap = (window as any).Capacitor;
  if (!cap) return null;
  
  // Try direct access first
  if (cap.Plugins?.Chromecast) {
    return cap.Plugins.Chromecast;
  }
  
  // Try getting it via isPluginAvailable
  if (cap.isPluginAvailable && cap.isPluginAvailable('Chromecast')) {
    return cap.Plugins?.Chromecast;
  }
  
  // Try via pluginId
  try {
    return cap.Plugins['Chromecast'];
  } catch (e) {
    return null;
  }
}

export function CastButton({ videoTitle = 'Video', posterUrl }: CastButtonProps) {
  const [isCasting, setIsCasting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleCast = useCallback(async () => {
    setIsLoading(true);
    setMessage('Connecting to Chromecast...');

    try {
      console.log('[Cast] Starting cast flow...');
      
      // Check if Capacitor is available
      const cap = (window as any).Capacitor;
      console.log('[Cast] window.Capacitor:', !!cap);
      if (!cap) {
        console.error('[Cast] Capacitor not found on window object');
        setMessage('Capacitor not available on this platform');
        setIsLoading(false);
        return;
      }

      console.log('[Cast] Capacitor.Plugins:', !!cap.Plugins);
      const pluginKeys = Object.keys(cap.Plugins || {});
      console.log('[Cast] Available plugins:', pluginKeys);
      console.log('[Cast] Plugin names:', pluginKeys.map(k => `"${k}"`).join(', '));
      
      // Get the plugin
      let castPlugin = getChromecastPlugin();
      console.log('[Cast] getChromecastPlugin() returned:', !!castPlugin);
      console.log('[Cast] Plugin type:', typeof castPlugin);
      console.log('[Cast] Direct Capacitor.Plugins.Chromecast:', !!cap.Plugins?.Chromecast);

      if (!castPlugin) {
        console.error('[Cast] Plugin not found on first attempt');
        console.log('[Cast] Trying direct access: Capacitor.Plugins.Chromecast');
        castPlugin = cap.Plugins?.Chromecast;
        console.log('[Cast] Direct access result:', !!castPlugin);
        
        if (!castPlugin) {
          console.error('[Cast] Plugin still not found after retry');
          setMessage('Chromecast plugin not registered. Please ensure the app was rebuilt.');
          setIsLoading(false);
          return;
        }
      }

      // Initialize the plugin FIRST
      console.log('[Cast] Calling initialize()...');
      await castPlugin.initialize();
      console.log('[Cast] initialize() returned successfully');

      // NOW get the stream
      setMessage('Getting stream...');
      const api = getDownloadAPI();
      let streams = await api.getCapturedStreams!();
      console.log('[Cast] getCapturedStreams returned:', streams?.length || 0, 'streams');

      // Retry if needed
      if (!streams || streams.length === 0) {
        console.log('[Cast] No streams, retrying...');
        for (let i = 0; i < 3; i++) {
          await new Promise(res => setTimeout(res, 500));
          const retry = await api.getCapturedStreams!();
          console.log('[Cast] Retry', i + 1, 'returned:', retry?.length || 0, 'streams');
          if (retry && retry.length > 0) {
            streams = retry;
            break;
          }
        }
      }

      if (!streams || streams.length === 0) {
        setMessage('No stream found. Play video for a few seconds first.');
        setIsLoading(false);
        return;
      }

      // Extract stream URL
      const raw = streams[0];
      const streamUrl = typeof raw === 'string' ? raw : raw?.url;

      if (!streamUrl) {
        setMessage('Could not extract stream URL');
        setIsLoading(false);
        return;
      }

      setMessage('Opening device picker...');

      // Now call cast
      const streamObj = streams[0];
      console.log('[Cast] Calling cast() with URL:', streamUrl.substring(0, 80));
      
      // Validate headers before sending
      let headersToSend: Record<string, string> = {};
      if (streamObj?.headers && typeof streamObj.headers === 'object') {
        try {
          // Only include non-null, non-undefined header values
          Object.entries(streamObj.headers).forEach(([key, value]) => {
            if (key && value) {
              headersToSend[key] = String(value);
            }
          });
          console.log('[Cast] Valid headers to send:', Object.keys(headersToSend).length);
        } catch (e) {
          console.warn('[Cast] Failed to validate headers:', e);
          headersToSend = {};
        }
      }

      const result = await castPlugin.cast({
        url: streamUrl,
        title: videoTitle || 'Video',
        imageUrl: posterUrl || undefined,
        headersJson: Object.keys(headersToSend).length > 0 ? JSON.stringify(headersToSend) : "{}"
      });

      console.log('[Cast] cast() returned:', {
        success: result?.success,
        device: result?.deviceName,
        hasUrl: !!result?.intermediaryUrl
      });

      if (result?.success) {
        setIsCasting(true);
        setShowHelp(true);
        setMessage(null);
        setIsLoading(false);
        console.log('[CastButton] Successfully cast to:', result?.deviceName);
      } else {
        const errorMsg = result?.error || 'Cast failed or cancelled';
        console.error('[CastButton] Cast failed:', errorMsg);
        setMessage(errorMsg);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[CastButton] Error:', err);
      console.error('[CastButton] Error stack:', err?.stack);
      setMessage('Error: ' + (err?.message || JSON.stringify(err)));
      setIsLoading(false);
    }
  }, [videoTitle, posterUrl]);

  const handleDisconnect = useCallback(async () => {
    try {
      const castPlugin = getChromecastPlugin();
      if (castPlugin) {
        await castPlugin.disconnect();
      }
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    setIsCasting(false);
  }, []);

  // Only show on Android/Capacitor - but always render the button
  // The button will show as disabled if not on a platform that supports it
  const platform = getPlatform();
  const isAvailable = platform === 'capacitor' && isDownloadAvailable();

  return (
    <>
      {isCasting ? (
        <Button
          onClick={handleDisconnect}
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8 text-green-500 hover:bg-green-500/20 flex-shrink-0"
          title="Casting - tap to stop"
        >
          <Tv className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      ) : (
        <Button
          onClick={handleCast}
          disabled={isLoading || !isAvailable}
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20 flex-shrink-0 disabled:opacity-50"
          title={isAvailable ? "Cast to Chromecast" : "Chromecast not available"}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
          ) : (
            <Tv className="h-3 w-3 sm:h-4 sm:w-4" />
          )}
        </Button>
      )}

      {message && (
        <Dialog open={!!message} onOpenChange={() => setMessage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>?? Chromecast</DialogTitle>
            </DialogHeader>
            <p className="text-sm">{message}</p>
            <Button onClick={() => setMessage(null)}>Close</Button>
          </DialogContent>
        </Dialog>
      )}

      {showHelp && (
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>?? Casting Started</DialogTitle>
            </DialogHeader>
            <p className="text-sm mb-4">Your video is now playing on Chromecast.</p>
            <div className="space-y-3 text-sm">
              <div>
                <strong>Subtitles:</strong>
                <p className="text-xs text-gray-600">Use your TV remote or Chromecast app to enable subtitles</p>
              </div>
              <div>
                <strong>Controls:</strong>
                <p className="text-xs text-gray-600">Use your phone, remote, or Chromecast app to control playback</p>
              </div>
            </div>
            <Button onClick={() => setShowHelp(false)} className="w-full mt-4">
              Got it
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
