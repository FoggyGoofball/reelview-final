package com.reelview.app;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class ReelViewWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "ReelViewWebViewClient";
    private Bridge bridge;
    
    private static final String[] EMBED_DOMAINS = {
        // Primary vidsrc domains
        "vidsrc.net", "vidsrc.me", "vidsrc.xyz", "vidsrc.in", "vidsrc.pm", "vidsrc.to",
        "vidsrc-embed.ru",  // CRITICAL - this is what the test app uses!
        // Vidlink
        "vidlink.pro",
        // 2embed
        "2embed.org", "2embed.to", "2embed.cc",
        // Autoembed
        "autoembed.to", "autoembed.cc",
        // GoDrive
        "godriveplayer.com", "godrive",
        // MoStream
        "mostream.us", "mostream",
        // Other providers
        "movierulz", "gomovies", "fmovies", "putlocker",
        "vidcloud", "vidplay", "filemoon", "streamwish",
        "doodstream", "upstream", "mixdrop", "mp4upload",
        "streamsb", "streamtape", "fembed", "evoload"
    };
    
    // Store headers captured from JavaScript for each URL
    private static Map<String, Map<String, String>> streamHeaders = new HashMap<>();

    public ReelViewWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        
        // Only log first 100 chars for privacy
        Log.d(TAG, "shouldInterceptRequest: " + url.substring(0, Math.min(100, url.length())));
        
        // ONLY intercept the actual HTML page request, not all sub-resources
        // This prevents modifying stylesheets, scripts, media, etc. that the embed might depend on
        if (isEmbedPageRequest(url)) {
            try {
                Log.d(TAG, "? INTERCEPTING EMBED HTML PAGE: " + url.substring(0, Math.min(100, url.length())));
                return interceptEmbedRequest(url);
            } catch (Exception e) {
                Log.e(TAG, "Error intercepting embed: " + e.getMessage(), e);
                // Fall through to normal handling on error - let embed load anyway
            }
        }
        
        // LAYER: Capture HLS streams by URL pattern (don't block, just observe)
        if (isHLSStream(url)) {
            Log.d(TAG, "? HLS stream detected: " + url.substring(0, Math.min(80, url.length())));
            captureStreamUrl(url);
        }
        
        // Let all other requests pass through - don't intercept resources
        return super.shouldInterceptRequest(view, request);
    }
    
    private boolean isEmbedPageRequest(String url) {
        // CRITICAL: Only intercept the initial HTML page load for the embed
        // NOT stylesheets, scripts, images, media, or API calls
        String lowerUrl = url.toLowerCase();
        
        // Don't intercept if it's a resource (JS, CSS, images, media, API)
        if (lowerUrl.endsWith(".js") || 
            lowerUrl.endsWith(".css") || 
            lowerUrl.endsWith(".woff") || 
            lowerUrl.endsWith(".woff2") || 
            lowerUrl.endsWith(".ttf") || 
            lowerUrl.endsWith(".png") || 
            lowerUrl.endsWith(".jpg") || 
            lowerUrl.endsWith(".gif") || 
            lowerUrl.endsWith(".svg") || 
            lowerUrl.endsWith(".ico") || 
            lowerUrl.endsWith(".json") ||
            lowerUrl.endsWith(".m3u8") ||
            lowerUrl.endsWith(".mpd") ||
            lowerUrl.contains("/api/") ||
            lowerUrl.contains("/v1/") ||
            lowerUrl.contains("/v2/")) {
            return false;
        }
        
        // Only intercept actual embed page loads
        boolean isEmbedDomain = false;
        if (lowerUrl.contains("vidsrc-embed.ru") && (lowerUrl.contains("embed/tv") || lowerUrl.contains("embed/movie"))) isEmbedDomain = true;
        if (lowerUrl.contains("vidlink.pro") && (lowerUrl.contains("embed") || lowerUrl.contains("movie") || lowerUrl.contains("tv"))) isEmbedDomain = true;
        if (lowerUrl.contains("2embed.") && (lowerUrl.contains("embed") || lowerUrl.contains("movie") || lowerUrl.contains("tv"))) isEmbedDomain = true;
        if (lowerUrl.contains("autoembed.") && (lowerUrl.contains("embed") || lowerUrl.contains("movie") || lowerUrl.contains("tv"))) isEmbedDomain = true;
        if (lowerUrl.contains("godriveplayer.com")) isEmbedDomain = true;
        if (lowerUrl.contains("mostream.us")) isEmbedDomain = true;
        
        if (isEmbedDomain) {
            // Verify no query params that indicate sub-resource request
            if (!lowerUrl.contains("?") || !lowerUrl.contains("&")) {
                Log.d(TAG, "? Embed page detected for interception");
                return true;
            }
        }
        
        return false;
    }
    
    // ============================================
    // EMBED INTERCEPTION LAYER
    // ============================================
    
    // Method replaced with isEmbedPageRequest() above
    // (keeping only the interception logic)
    
    private WebResourceResponse interceptEmbedRequest(String url) throws Exception {
        // Download original HTML from embed provider
        String originalHtml = fetchUrl(url);
        
        // Get our defense scripts
        String throttlerScript = getThrottlerScript();
        String defenseScript = getDefenseScript();
        
        // Inject scripts at document start
        String injectedHtml = injectDefenseScript(originalHtml, throttlerScript, defenseScript);
        
        Log.d(TAG, "? Injected defense scripts into embed HTML (" + originalHtml.length() + " ? " + injectedHtml.length() + " bytes)");
        
        // Return modified HTML response with proper headers
        HashMap<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "text/html; charset=utf-8");
        headers.put("Cache-Control", "no-cache, no-store");
        
        return new WebResourceResponse(
            "text/html",
            "utf-8",
            200,
            "OK",
            headers,
            new ByteArrayInputStream(injectedHtml.getBytes(StandardCharsets.UTF_8))
        );
    }
    
    private String fetchUrl(String urlString) throws Exception {
        URL url = new URL(urlString);
        URLConnection connection = url.openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36");
        
        BufferedReader reader = new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
        );
        
        StringBuilder html = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            html.append(line).append("\n");
        }
        reader.close();
        
        return html.toString();
    }
    
    private String getDefenseScript() {
        try {
            java.io.InputStream is = bridge.getActivity().getAssets().open("defense-script.js");
            BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
            br.close();
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "Failed to load defense script from assets", e);
            return "console.error('[DEFENSE] Failed to load defense script');";
        }
    }
    
    private String getThrottlerScript() {
        try {
            java.io.InputStream is = bridge.getActivity().getAssets().open("timer-throttle.js");
            BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
            br.close();
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "Failed to load timer throttler script", e);
            return "";  // If throttler fails to load, defense script still runs
        }
    }
    
    private String injectDefenseScript(String html, String throttlerScript, String defenseScript) {
        // INJECTION ORDER IS CRITICAL:
        // 1. Timer throttling (prevents mining while player initializes)
        // 2. Ad defense (blocks navigation/popups)
        // 3. Original HTML content (untouched)
        
        String injectedHtml = "<!DOCTYPE html><html><head>" +
            "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
            "<script>" + throttlerScript + "</script>" +  // FIRST: Throttle timers/workers
            "<script>" + defenseScript + "</script>" +     // SECOND: Block ads
            "</head><body>" +
            html.replaceFirst("(?i)<body[^>]*>", "") + 
            "</body></html>";
        
        Log.d(TAG, "? Injected defense scripts (throttler + defense) at document start");
        return injectedHtml;
    }
    
    // ============================================
    // STREAM CAPTURE LAYER (existing functionality)
    // ============================================
    
    private boolean isHLSStream(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        
        return lowerUrl.contains(".m3u8") ||
               lowerUrl.contains("/hls/") ||
               lowerUrl.contains("/playlist") ||
               lowerUrl.contains("/manifest") ||
               lowerUrl.contains("/pl/") ||
               lowerUrl.contains("/master.") ||
               lowerUrl.contains("stream") && lowerUrl.contains("m3u");
    }
    
    private void captureStreamUrl(String url) {
        try {
            HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
            
            if (plugin != null) {
                plugin.captureStreamFromNative(url);
                Log.d(TAG, "? Stream captured: " + url.substring(0, Math.min(80, url.length())));
            } else {
                Log.w(TAG, "? HLSDownloaderPlugin not yet available, queuing stream");
                PendingStreamCapture.queueStream(url);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error capturing stream: " + e.getMessage(), e);
        }
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        
        if (url != null && url.contains("/watch")) {
            injectStreamCaptureAndHeaderScript(view);
        }
        
        MainActivity activity = (MainActivity) bridge.getActivity();
        if (activity == null) return;

        if (url != null && url.contains("/watch")) {
            String smartThrottleJs = 
                "(function() { " +
                "   if (window.timerListenerAttached) return; " +
                "   window.timerListenerAttached = true; " +
                "   const disableTimersWithDelay = () => { " +
                "       console.log('First user interaction on watch page. Disabling timers in 500ms.'); " +
                "       setTimeout(() => { " +
                "           console.log('Executing full timer block.'); " +
                "           window.setInterval = function() {}; " +
                "           window.setTimeout = function() {}; " +
                "       }, 500); " +
                "   }; " +
                "   document.addEventListener('click', disableTimersWithDelay, { once: true }); " +
                "})();";
            view.evaluateJavascript(smartThrottleJs, null);
        } 
    }
    
    private void injectStreamCaptureAndHeaderScript(WebView view) {
        String captureScript = 
            "(function() {" +
            "  if (window.__hlsCaptureInstalled) return;" +
            "  window.__hlsCaptureInstalled = true;" +
            "" +
            "  function captureStream(url, headers) {" +
            "    if (url && (url.includes('.m3u8') || url.includes('/pl/') || url.includes('/hls/') || url.includes('/manifest'))) {" +
            "      console.log('[HLS-CAPTURE-JS] Captured:', url.substring(0, 100));" +
            "      console.log('[HLS-CAPTURE-JS] Headers:', JSON.stringify(headers).substring(0, 200));" +
            "      if (window.Capacitor) {" +
            "        window.Capacitor.Plugins.HLSDownloader.captureStream({ url: url }).catch(() => {});" +
            "        window.Capacitor.Plugins.HLSDownloader.storeHeaders({ url: url, headers: headers }).catch(() => {});" +
            "      }" +
            "    }" +
            "  }" +
            "" +
            "  const originalFetch = window.fetch;" +
            "  window.fetch = function(...args) {" +
            "    const input = args[0];" +
            "    const options = args[1] || {};" +
            "    const url = typeof input === 'string' ? input : input?.url;" +
            "    const headers = options.headers || {};" +
            "    if (url && (url.includes('.m3u8') || url.includes('/hls/') || url.includes('/pl/'))) {" +
            "      captureStream(url, headers);" +
            "    }" +
            "    return originalFetch.apply(this, args);" +
            "  };" +
            "" +
            "  const originalXhrOpen = XMLHttpRequest.prototype.open;" +
            "  const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;" +
            "  let xhrHeaders = {};" +
            "" +
            "  XMLHttpRequest.prototype.open = function(method, url, ...args) {" +
            "    xhrHeaders = {};" +
            "    this.__originalURL = url;" +
            "    return originalXhrOpen.apply(this, [method, url, ...args]);" +
            "  };" +
            "" +
            "  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {" +
            "    xhrHeaders[name] = value;" +
            "    return originalXhrSetHeader.apply(this, [name, value]);" +
            "  };" +
            "" +
            "  const originalXhrSend = XMLHttpRequest.prototype.send;" +
            "  XMLHttpRequest.prototype.send = function(...args) {" +
            "    const url = this.__originalURL;" +
            "    if (url && (url.includes('.m3u8') || url.includes('/hls/') || url.includes('/pl/'))) {" +
            "      captureStream(url, xhrHeaders);" +
            "    }" +
            "    return originalXhrSend.apply(this, args);" +
            "  };" +
            "" +
            "  const observer = new MutationObserver(function(mutations) {" +
            "    mutations.forEach(function(mutation) {" +
            "      if (mutation.target.tagName === 'SOURCE') {" +
            "        captureStream(mutation.target.src, {});" +
            "      }" +
            "    });" +
            "  });" +
            "" +
            "  observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['src'] });" +
            "  console.log('[HLS-CAPTURE-JS] Stream capture with headers installed');" +
            "})();";
        
        try {
            view.evaluateJavascript(captureScript, null);
            Log.d(TAG, "? Stream capture script (with header capture) injected");
        } catch (Exception e) {
            Log.e(TAG, "Error injecting capture script: " + e.getMessage());
        }
    }

    public static void storeHeaders(String url, Map<String, String> headers) {
        streamHeaders.put(url, new HashMap<>(headers));
        Log.d(TAG, "[HEADERS] Stored " + headers.size() + " headers for: " + url.substring(0, Math.min(80, url.length())));
        
        for (String headerName : headers.keySet()) {
            Log.d(TAG, "[HEADER] " + headerName + ": [value present]");
        }
    }

    public static Map<String, String> getHeaders(String url) {
        Map<String, String> headers = streamHeaders.get(url);
        if (headers != null) {
            Log.d(TAG, "[HEADERS] Retrieved " + headers.size() + " headers for: " + url.substring(0, Math.min(80, url.length())));
            return new HashMap<>(headers);
        }
        Log.d(TAG, "[HEADERS] No headers stored for: " + url.substring(0, Math.min(80, url.length())));
        return new HashMap<>();
    }

    public static void clearHeaders() {
        streamHeaders.clear();
        Log.d(TAG, "[HEADERS] All headers cleared");
    }
    
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        String currentUrl = view.getUrl() != null ? view.getUrl() : "";
        
        Log.d(TAG, "shouldOverrideUrlLoading: " + url.substring(0, Math.min(100, url.length())));
        
        // Check if navigation is allowed
        if (isAllowedNavigation(url, currentUrl)) {
            Log.d(TAG, "? Allowing navigation: " + url.substring(0, Math.min(80, url.length())));
            return false; // Let WebView handle it
        }
        
        // Block the navigation
        Log.d(TAG, "? BLOCKING navigation: " + url.substring(0, Math.min(80, url.length())));
        return true; // Block this URL
    }
    
    private boolean isAllowedNavigation(String url, String currentUrl) {
        String lowerUrl = url.toLowerCase();
        String lowerCurrent = currentUrl.toLowerCase();
        
        // Allow same-origin navigation
        if (url.startsWith(currentUrl) || url.startsWith("about:")) return true;
        if (lowerUrl.startsWith("file://")) return true;
        if (lowerUrl.startsWith("javascript:")) return true;
        if (lowerUrl.startsWith("data:")) return true;
        if (lowerUrl.startsWith("blob:")) return true;
        
        // Allow internal SPA routes
        if (lowerUrl.contains("localhost")) return true;
        if (url.startsWith("/")) return true;
        
        // Allow embed providers and their infrastructure
        if (isEmbedProvider(lowerUrl)) return true;
        
        // CRITICAL: Allow embed support infrastructure (auth, CDN, licensing, analytics)
        // These domains are used by embeds for session validation, DRM, etc.
        if (isEmbedSupportDomain(lowerUrl)) return true;
        
        // Block everything else - external ads, tracking, suspicious sites
        Log.d(TAG, "? External navigation blocked: " + url.substring(0, Math.min(80, url.length())));
        return false;
    }
    
    private boolean isEmbedSupportDomain(String url) {
        // CDN and streaming infrastructure used by embeds
        return url.contains("cloudflare") ||
               url.contains("akamai") ||
               url.contains("fastly") ||
               url.contains("amazonaws") ||
               url.contains("cdn") ||
               url.contains("edge") ||
               url.contains("lcdn") ||
               url.contains("streaming") ||
               url.contains("stream.") ||
               // Analytics (embed verification)
               url.contains("analytics") ||
               url.contains("segment.io") ||
               url.contains("mixpanel") ||
               url.contains("google-analytics") ||
               // Auth/Session
               url.contains("auth") ||
               url.contains("passport") ||
               url.contains("oauth") ||
               url.contains("session") ||
               // DRM/Licensing
               url.contains("drm") ||
               url.contains("widevine") ||
               url.contains("license") ||
               url.contains("fairplay") ||
               // Common embed service providers
               url.contains("jwplayer") ||
               url.contains("brightcove") ||
               url.contains("kaltura") ||
               url.contains("ooyala") ||
               url.contains("vimeo.com") ||
               url.contains("youtube.com") ||
               url.contains("dailymotion") ||
               url.contains("bitmovin") ||
               url.contains("theoplayer") ||
               url.contains("conviva") ||
               // HLS/DASH specific
               url.contains(".m3u8") ||
               url.contains(".mpd") ||
               url.contains("/hls/") ||
               url.contains("/dash/");
    }
    
    private boolean isEmbedProvider(String url) {
        return url.contains("vidsrc-embed.ru") ||
               url.contains("vidsrc.net") ||
               url.contains("vidsrc.me") ||
               url.contains("vidlink.pro") ||
               url.contains("2embed.") ||
               url.contains("autoembed.") ||
               url.contains("godriveplayer.com") ||
               url.contains("mostream.us") ||
               url.contains("vidcloud") ||
               url.contains("vidplay") ||
               url.contains("filemoon") ||
               url.contains("streamwish") ||
               url.contains("doodstream") ||
               url.contains("upstream") ||
               url.contains("mixdrop") ||
               url.contains("mp4upload") ||
               url.contains("streamsb") ||
               url.contains("streamtape") ||
               url.contains("fembed") ||
               url.contains("evoload");
    }
}
