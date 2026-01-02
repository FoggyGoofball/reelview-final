/**
 * Android Stream Detector
 * 
 * Detects HLS/M3U8 streams on Android Capacitor and sends them
 * to the native plugin for download capability.
 */

import { Capacitor } from '@capacitor/core';

let isInitialized = false;

function log(...args: any[]) {
  console.log('[ANDROID-STREAM-DETECTOR]', ...args);
}

/**
 * Check if URL is an HLS stream
 */
function isHLSStream(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.includes('.m3u8') ||
    lowerUrl.includes('/hls/') ||
    lowerUrl.includes('/manifest') ||
    lowerUrl.includes('master.json') ||
    lowerUrl.includes('/pl/')
  );
}

/**
 * Send stream URL to native plugin via custom scheme
 */
function captureStream(url: string) {
  if (!isHLSStream(url)) return;
  
  log('Detected stream:', url.substring(0, 100));
  
  // Method 1: Use custom scheme (caught by shouldInterceptRequest)
  try {
    fetch('reelview-capture://' + encodeURIComponent(url)).catch(() => {
      // Expected to fail, but triggers interception
    });
  } catch (e) {
    // Ignore
  }
  
  // Method 2: Also try direct Capacitor plugin call
  try {
    if ((window as any).Capacitor?.Plugins?.HLSDownloader) {
      (window as any).Capacitor.Plugins.HLSDownloader.captureStream({ url });
    }
  } catch (e) {
    // Plugin might not be ready yet
  }
}

/**
 * Hook Fetch API
 */
function hookFetch() {
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    const url = args[0];
    const urlString = typeof url === 'string' ? url : url?.toString() || '';
    
    if (isHLSStream(urlString)) {
      captureStream(urlString);
    }
    
    return originalFetch.apply(this, args);
  };
  
  log('Fetch API hooked');
}

/**
 * Hook XMLHttpRequest
 */
function hookXHR() {
  const originalOpen = XMLHttpRequest.prototype.open;
  
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
    const urlString = url?.toString() || '';
    
    if (isHLSStream(urlString)) {
      captureStream(urlString);
    }
    
    return originalOpen.apply(this, [method, url, ...args] as any);
  };
  
  log('XMLHttpRequest hooked');
}

/**
 * Watch for video source elements
 */
function watchVideoSources() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          // Check if it's a source element
          if (node.tagName === 'SOURCE') {
            const src = (node as HTMLSourceElement).src;
            if (isHLSStream(src)) {
              captureStream(src);
            }
          }
          
          // Check for video elements
          if (node.tagName === 'VIDEO') {
            const video = node as HTMLVideoElement;
            if (isHLSStream(video.src)) {
              captureStream(video.src);
            }
            // Check child sources
            video.querySelectorAll('source').forEach(source => {
              if (isHLSStream(source.src)) {
                captureStream(source.src);
              }
            });
          }
          
          // Check iframes (might contain video)
          if (node.tagName === 'IFRAME') {
            const iframe = node as HTMLIFrameElement;
            // Can't access cross-origin iframe content, but log it
            log('Detected iframe:', iframe.src?.substring(0, 100));
          }
          
          // Recurse into children
          if (node.querySelector) {
            node.querySelectorAll('source, video').forEach(el => {
              const src = (el as HTMLSourceElement | HTMLVideoElement).src;
              if (isHLSStream(src)) {
                captureStream(src);
              }
            });
          }
        }
      });
    });
  });
  
  // Start observing
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    log('DOM observer started');
  } else {
    // Wait for body
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      });
      log('DOM observer started (after DOMContentLoaded)');
    });
  }
}

/**
 * Scan existing video elements
 */
function scanExistingVideos() {
  document.querySelectorAll('video, source').forEach(el => {
    const src = (el as HTMLSourceElement | HTMLVideoElement).src;
    if (isHLSStream(src)) {
      captureStream(src);
    }
  });
  
  // Also scan iframes for logging
  document.querySelectorAll('iframe').forEach(iframe => {
    log('Existing iframe:', iframe.src?.substring(0, 100));
  });
}

/**
 * Initialize Android Stream Detector
 */
export function initializeAndroidStreamDetector() {
  // Only run on Android
  if (Capacitor.getPlatform() !== 'android') {
    log('Not Android, skipping initialization');
    return;
  }
  
  if (isInitialized) {
    log('Already initialized');
    return;
  }
  
  log('Initializing Android Stream Detector');
  
  // Hook network APIs
  hookFetch();
  hookXHR();
  
  // Watch DOM for video elements
  watchVideoSources();
  
  // Scan existing elements
  scanExistingVideos();
  
  isInitialized = true;
  log('Android Stream Detector initialized');
}
