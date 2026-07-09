/**
 * ReelView Stream Worker
 * 
 * Intercepts video stream requests and fetches them directly from sources
 * with proper headers, eliminating the need for server-side proxying.
 * 
 * This reduces bandwidth costs and improves performance by:
 * - Fetching directly from source (no proxy hop)
 * - Adding provider-specific headers client-side
 * - Caching responses when appropriate
 */

const WORKER_VERSION = '1.0.0';
const LOG_PREFIX = '[StreamWorker]';

// Header profiles for different video sources
const HEADER_PROFILES = {
  'empoweredfreelancerhub.site': {
    'Referer': 'https://empoweredfreelancerhub.site/',
    'Origin': 'https://empoweredfreelancerhub.site',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  'default': {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

/**
 * Log messages with timestamp and worker identifier
 */
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `${LOG_PREFIX} [${timestamp}] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

/**
 * Get headers for a specific source URL
 */
function getHeadersForSource(url) {
  try {
    const hostname = new URL(url).hostname;
    log('DEBUG', `Getting headers for hostname: ${hostname}`);
    
    // Check for exact match
    if (HEADER_PROFILES[hostname]) {
      log('INFO', `Using specific headers for ${hostname}`);
      return HEADER_PROFILES[hostname];
    }
    
    // Check for partial match
    for (const [domain, headers] of Object.entries(HEADER_PROFILES)) {
      if (domain !== 'default' && hostname.includes(domain)) {
        log('INFO', `Using headers for ${domain} (partial match)`);
        return headers;
      }
    }
    
    // Use default headers
    log('INFO', 'Using default headers');
    return HEADER_PROFILES['default'];
  } catch (error) {
    log('ERROR', 'Failed to parse URL for headers', { url, error: error.message });
    return HEADER_PROFILES['default'];
  }
}

/**
 * Extract source URL from stream request
 * Format: /stream/{encoded-url}
 */
function extractSourceUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const pathParts = url.pathname.split('/');
    
    // Find the 'stream' segment
    const streamIndex = pathParts.indexOf('stream');
    if (streamIndex === -1 || streamIndex === pathParts.length - 1) {
      log('ERROR', 'Invalid stream URL format', { requestUrl });
      return null;
    }
    
    // Extract and decode the source URL
    const encodedUrl = pathParts.slice(streamIndex + 1).join('/');
    const sourceUrl = decodeURIComponent(encodedUrl);
    
    log('DEBUG', 'Extracted source URL', { sourceUrl });
    return sourceUrl;
  } catch (error) {
    log('ERROR', 'Failed to extract source URL', { requestUrl, error: error.message });
    return null;
  }
}

/**
 * Fetch content from source with proper headers
 */
async function fetchFromSource(sourceUrl, originalRequest) {
  const headers = getHeadersForSource(sourceUrl);
  
  // Copy relevant headers from original request
  const fetchHeaders = { ...headers };
  
  // Forward Range header for seeking
  if (originalRequest.headers.get('Range')) {
    fetchHeaders['Range'] = originalRequest.headers.get('Range');
    log('DEBUG', 'Forwarding Range header', { range: fetchHeaders['Range'] });
  }
  
  log('INFO', 'Fetching from source', { 
    sourceUrl, 
    headers: Object.keys(fetchHeaders) 
  });
  
  const startTime = performance.now();
  
  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: fetchHeaders,
      mode: 'cors',
      credentials: 'omit'
    });
    
    const duration = performance.now() - startTime;
    
    log('INFO', 'Source fetch completed', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      duration: `${duration.toFixed(2)}ms`
    });
    
    // Create new response with CORS headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.set('Access-Control-Expose-Headers', '*');
    
    // Add custom header to indicate worker was used
    newHeaders.set('X-ReelView-Worker', WORKER_VERSION);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    const duration = performance.now() - startTime;
    log('ERROR', 'Source fetch failed', {
      sourceUrl,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`
    });
    throw error;
  }
}

/**
 * Handle fetch events
 */
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  
  // Only intercept /stream/ requests
  if (!requestUrl.includes('/stream/')) {
    return;
  }
  
  log('INFO', 'Intercepting stream request', { requestUrl });
  
  event.respondWith((async () => {
    try {
      // Extract source URL
      const sourceUrl = extractSourceUrl(requestUrl);
      if (!sourceUrl) {
        log('ERROR', 'Could not extract source URL');
        return new Response('Invalid stream URL', { status: 400 });
      }
      
      // Fetch from source
      const response = await fetchFromSource(sourceUrl, event.request);
      return response;
      
    } catch (error) {
      log('ERROR', 'Stream request failed', {
        requestUrl,
        error: error.message,
        stack: error.stack
      });
      
      // Return error response
      return new Response(
        JSON.stringify({
          error: 'Stream fetch failed',
          message: error.message,
          workerVersion: WORKER_VERSION
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })());
});

/**
 * Handle install event
 */
self.addEventListener('install', (event) => {
  log('INFO', 'Service worker installing', { version: WORKER_VERSION });
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Handle activate event
 */
self.addEventListener('activate', (event) => {
  log('INFO', 'Service worker activating', { version: WORKER_VERSION });
  
  // Claim all clients immediately
  event.waitUntil(
    self.clients.claim().then(() => {
      log('INFO', 'Service worker claimed all clients');
    })
  );
});

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  log('INFO', 'Received message from client', { data: event.data });
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: WORKER_VERSION });
  }
  
  if (event.data.type === 'ADD_HEADER_PROFILE') {
    const { domain, headers } = event.data;
    HEADER_PROFILES[domain] = headers;
    log('INFO', 'Added header profile', { domain });
    event.ports[0].postMessage({ success: true });
  }
});

log('INFO', 'Stream worker loaded', { version: WORKER_VERSION });