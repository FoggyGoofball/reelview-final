/**
 * Ad Capture System
 * 
 * Intercepts popup ads and captures them in invisible jails.
 * Works on both Android (Capacitor) and Desktop (Electron).
 */

export interface AdCaptureConfig {
  enableLogging: boolean;
  closureDelay: number;
  muteAudio: boolean;
  maxConcurrentAds: number;
}

const defaultConfig: AdCaptureConfig = {
  enableLogging: true,
  closureDelay: 600,
  muteAudio: true,
  maxConcurrentAds: 5,
};

let config: AdCaptureConfig = { ...defaultConfig };
let originalWindowOpen: typeof window.open | null = null;
let adJails: HTMLIFrameElement[] = [];

function log(...args: any[]) {
  if (config.enableLogging) {
    console.log('[AD_CAPTURE]', ...args);
  }
}

/**
 * Check if URL is from an allowed embed provider
 */
function isEmbedProviderUrl(url: string): boolean {
  const embedProviders = [
    'vidsrc.net', 'vidsrc.me', 'vidsrc.xyz', 'vidsrc.in', 'vidsrc.pm', 'vidsrc.to',
    'vidlink.pro', '2embed.org', '2embed.to', '2embed.cc',
    'autoembed.to', 'autoembed.cc',
    'movierulz', 'gomovies', 'fmovies', 'putlocker',
    'vidcloud', 'vidplay', 'filemoon', 'streamwish',
    'doodstream', 'upstream', 'mixdrop', 'mp4upload',
    'streamsb', 'streamtape', 'fembed', 'evoload',
    'imdb.com', 'themoviedb.org', 'thetvdb.com',
    'reelview.localhost', 'localhost',
  ];
  
  const lowerUrl = url.toLowerCase();
  return embedProviders.some(provider => lowerUrl.includes(provider));
}

/**
 * Check if URL is likely an ad
 */
function isLikelyAdUrl(url: string): boolean {
  const adPatterns = [
    'doubleclick', 'googlesyndication', 'googleadservices',
    'facebook.com/tr', 'analytics', 'tracker',
    'adnxs', 'criteo', 'taboola', 'outbrain',
    'popads', 'popcash', 'popunder', 'propeller',
    'exoclick', 'juicyads', 'trafficjunky',
    'ad.', 'ads.', '/ad/', '/ads/', 'banner',
    'affiliate', 'click.', 'track.',
  ];
  
  const lowerUrl = url.toLowerCase();
  return adPatterns.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check if URL should be allowed through (external links like IMDB)
 */
function isAllowedExternalUrl(url: string): boolean {
  const allowedDomains = [
    'imdb.com',
    'themoviedb.org',
    'thetvdb.com',
    'wikipedia.org',
    'rotten.tomatoes.com',
  ];
  
  const lowerUrl = url.toLowerCase();
  return allowedDomains.some(domain => lowerUrl.includes(domain));
}

/**
 * Create an invisible jail iframe to capture an ad
 */
function captureAdInIframe(url: string): Window | null {
  log('Capturing ad:', url.substring(0, 100));
  
  // Limit concurrent ads
  if (adJails.length >= config.maxConcurrentAds) {
    const oldest = adJails.shift();
    if (oldest && oldest.parentNode) {
      oldest.parentNode.removeChild(oldest);
    }
  }
  
  // Create invisible container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
    z-index: -9999;
  `;
  
  // Create iframe jail
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 1px;
    height: 1px;
    border: none;
    visibility: hidden;
  `;
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.src = url;
  
  // Mute audio
  if (config.muteAudio) {
    iframe.setAttribute('allow', 'autoplay; muted');
  }
  
  container.appendChild(iframe);
  document.body.appendChild(container);
  adJails.push(iframe);
  
  // Schedule cleanup
  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
      log('Ad jail destroyed after', config.closureDelay, 'ms');
    }
    const index = adJails.indexOf(iframe);
    if (index > -1) {
      adJails.splice(index, 1);
    }
  }, config.closureDelay);
  
  // Return fake window object
  return iframe.contentWindow;
}

/**
 * Intercept window.open calls
 */
function interceptWindowOpen() {
  if (originalWindowOpen) return; // Already intercepted
  
  originalWindowOpen = window.open;
  
  window.open = function(url?: string | URL, target?: string, features?: string): Window | null {
    const urlString = url?.toString() || '';
    
    log('window.open intercepted:', urlString.substring(0, 100));
    
    // Allow empty or about:blank
    if (!urlString || urlString === 'about:blank') {
      return originalWindowOpen!.call(window, url, target, features);
    }
    
    // Allow allowed external sites (IMDB, etc.)
    if (isAllowedExternalUrl(urlString)) {
      log('Allowing external URL:', urlString);
      return originalWindowOpen!.call(window, url, target, features);
    }
    
    // Allow embed providers
    if (isEmbedProviderUrl(urlString)) {
      log('Allowing embed provider:', urlString);
      return originalWindowOpen!.call(window, url, target, features);
    }
    
    // Block likely ads
    if (isLikelyAdUrl(urlString)) {
      log('Blocking ad URL:', urlString);
      return captureAdInIframe(urlString);
    }
    
    // Default: Capture in jail (safety measure)
    log('Capturing unknown URL:', urlString);
    return captureAdInIframe(urlString);
  };
  
  log('window.open intercepted');
}

/**
 * Block location changes from ads
 */
function blockLocationChanges() {
  // Can't directly override location, but we can catch some patterns
  // This is best-effort and limited by browser security
  try {
    const originalAssign = window.location.assign;
    window.location.assign = function(url: string) {
      if (isLikelyAdUrl(url)) {
        log('Blocked location.assign to ad:', url);
        return;
      }
      return originalAssign.call(window.location, url);
    };
  } catch (e) {
    // Some browsers don't allow this
  }
}

/**
 * Initialize the Ad Capture system
 */
export function initializeAdCapture(userConfig?: Partial<AdCaptureConfig>) {
  config = { ...defaultConfig, ...userConfig };
  
  log('Initializing Ad Capture System');
  log('Config:', config);
  
  // Only run in browser
  if (typeof window === 'undefined') return;
  
  // Intercept window.open
  interceptWindowOpen();
  
  // Block location changes
  blockLocationChanges();
  
  // Handle clicks on links with target="_blank"
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    
    if (link && link.target === '_blank') {
      const href = link.href;
      
      if (isLikelyAdUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        captureAdInIframe(href);
        log('Blocked target="_blank" ad link:', href);
      }
    }
  }, true);
  
  log('Ad Capture System initialized');
}

/**
 * Cleanup all ad jails
 */
export function cleanupAdCapture() {
  adJails.forEach(iframe => {
    if (iframe.parentNode?.parentNode) {
      iframe.parentNode.parentNode.removeChild(iframe.parentNode);
    }
  });
  adJails = [];
  log('All ad jails cleaned up');
}
