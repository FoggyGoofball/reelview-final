/**
 * Chromecast Integration Library
 * 
 * Handles communication with the native ChromecastPlugin
 * which uses the static intermediary website for authenticated streaming.
 */

interface CastOptions {
  url: string;
  title?: string;
  imageUrl?: string;
  headers?: Record<string, string>;
}

interface CastResult {
  success: boolean;
  intermediaryUrl?: string;
  deviceName?: string;
  error?: string;
}

/**
 * Get the Chromecast plugin from Capacitor
 */
export function getChromecastPlugin() {
  try {
    const cap = (window as any).Capacitor;
    if (!cap) {
      console.warn('[Chromecast] Capacitor not available');
      return null;
    }
    
    // Try direct access first
    if (cap.Plugins?.Chromecast) {
      console.log('[Chromecast] Plugin found via cap.Plugins.Chromecast');
      return cap.Plugins.Chromecast;
    }
    
    // Try getting it via isPluginAvailable
    if (cap.isPluginAvailable && cap.isPluginAvailable('Chromecast')) {
      console.log('[Chromecast] Plugin available via isPluginAvailable');
      return cap.Plugins?.Chromecast;
    }
    
    // Try via pluginId
    if (cap.Plugins && cap.Plugins['Chromecast']) {
      console.log('[Chromecast] Plugin found via pluginId');
      return cap.Plugins['Chromecast'];
    }
    
    console.warn('[Chromecast] Plugin not found in any location');
    return null;
  } catch (e) {
    console.error('[Chromecast] Error getting plugin:', e);
    return null;
  }
}

/**
 * Check if Chromecast is available on this platform
 */
export function isChromecastAvailable(): boolean {
  const cap = (window as any).Capacitor;
  if (!cap?.Plugins?.Chromecast) {
    return false;
  }
  return true;
}

/**
 * Initialize Chromecast plugin
 */
export async function initializeChromecast(): Promise<boolean> {
  try {
    const plugin = getChromecastPlugin();
    if (!plugin) {
      console.log('[Chromecast] Plugin not available on this platform');
      return false;
    }

    const result = await plugin.initialize();
    console.log('[Chromecast] Initialized:', result);
    return true;
  } catch (error) {
    console.error('[Chromecast] Initialize error:', error);
    return false;
  }
}

/**
 * Cast a stream to Chromecast
 * 
 * The stream is cast through the intermediary website which handles
 * injecting authentication headers via HLS.js
 */
export async function castStream(options: CastOptions): Promise<CastResult> {
  try {
    // Validate input
    if (!options || typeof options !== 'object') {
      console.error('[Chromecast] Invalid options object');
      return {
        success: false,
        error: 'Invalid cast options'
      };
    }

    if (!options.url || typeof options.url !== 'string' || options.url.trim() === '') {
      console.error('[Chromecast] Stream URL is required and must be a non-empty string');
      return {
        success: false,
        error: 'Stream URL is required'
      };
    }

    const plugin = getChromecastPlugin();
    if (!plugin) {
      console.warn('[Chromecast] Plugin not available - likely not on Android');
      return {
        success: false,
        error: 'Chromecast plugin not available on this platform'
      };
    }

    console.log('[Chromecast] Casting:', {
      url: options.url.substring(0, 80),
      title: options.title || 'Unknown',
      headersCount: options.headers ? Object.keys(options.headers).length : 0
    });

    // Sanitize and validate headers
    let sanitizedHeaders: Record<string, string> = {};
    if (options.headers && typeof options.headers === 'object') {
      try {
        Object.entries(options.headers).forEach(([key, value]) => {
          // Only include non-null, string-convertible values
          if (key && value != null) {
            sanitizedHeaders[key] = String(value).trim();
          }
        });
      } catch (e) {
        console.warn('[Chromecast] Failed to sanitize headers:', e);
      }
    }

    const result = await plugin.cast({
      url: options.url.trim(),
      title: options.title || 'Casting...',
      imageUrl: options.imageUrl || undefined,
      headersJson: Object.keys(sanitizedHeaders).length > 0 ? JSON.stringify(sanitizedHeaders) : "{}"
    });

    if (!result) {
      console.error('[Chromecast] Plugin returned undefined result');
      return {
        success: false,
        error: 'No response from plugin'
      };
    }

    if (result?.success) {
      console.log('[Chromecast] ? Cast successful to:', result.deviceName);
      return {
        success: true,
        intermediaryUrl: result.intermediaryUrl,
        deviceName: result.deviceName
      };
    } else {
      const errorMsg = result?.error || 'Unknown error';
      console.error('[Chromecast] Cast failed:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  } catch (error) {
    console.error('[Chromecast] Cast error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Disconnect from Chromecast
 */
export async function disconnectChromecast(): Promise<boolean> {
  try {
    const plugin = getChromecastPlugin();
    if (!plugin) return true;

    const result = await plugin.disconnect();
    console.log('[Chromecast] Disconnected:', result);
    return true;
  } catch (error) {
    console.error('[Chromecast] Disconnect error:', error);
    return false;
  }
}

/**
 * Open the intermediary website in browser for casting
 */
export async function openCastingUI(intermediaryUrl: string): Promise<void> {
  try {
    const cap = (window as any).Capacitor;
    
    if (cap?.Plugins?.Browser) {
      await cap.Plugins.Browser.open({
        url: intermediaryUrl,
        presentationStyle: 'popover'
      });
      console.log('[Chromecast] Opened casting UI in browser');
    } else {
      window.open(intermediaryUrl, 'chromecast', 'width=800,height=600');
      console.log('[Chromecast] Opened casting UI in window');
    }
  } catch (error) {
    console.error('[Chromecast] Error opening casting UI:', error);
  }
}