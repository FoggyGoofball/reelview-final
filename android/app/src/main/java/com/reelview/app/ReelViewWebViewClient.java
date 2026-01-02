package com.reelview.app;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public class ReelViewWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "ReelViewWebViewClient";
    private Bridge bridge;

    public ReelViewWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        
        Log.d(TAG, "shouldInterceptRequest called for: " + url.substring(0, Math.min(100, url.length())));
        
        // Capture HLS streams by URL pattern
        if (isHLSStream(url)) {
            Log.d(TAG, "? HLS stream MATCHED (URL pattern): " + url.substring(0, Math.min(100, url.length())));
            captureStreamUrl(url);
        }
        
        return super.shouldInterceptRequest(view, request);
    }
    
    /**
     * Check if URL is an HLS stream
     */
    private boolean isHLSStream(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        
        // Must have m3u8 extension or be from known HLS paths
        return lowerUrl.contains(".m3u8") ||
               lowerUrl.contains("/hls/") ||
               lowerUrl.contains("/playlist") ||
               lowerUrl.contains("/manifest") ||
               lowerUrl.contains("/pl/") ||           // Common playlist path
               lowerUrl.contains("/master.") ||       // Master playlist
               lowerUrl.contains("stream") && lowerUrl.contains("m3u");  // Various stream patterns
    }
    
    /**
     * Send captured stream URL to the HLSDownloaderPlugin
     */
    private void captureStreamUrl(String url) {
        try {
            HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
            
            if (plugin != null) {
                plugin.captureStreamFromNative(url);
                Log.d(TAG, "? Stream captured: " + url.substring(0, Math.min(80, url.length())));
            } else {
                // Plugin not yet loaded - queue for later
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
        
        // Inject JavaScript to capture streams at the network level
        // This catches streams that shouldInterceptRequest might miss
        if (url != null && url.contains("/watch")) {
            injectStreamCaptureScript(view);
        }
        
        MainActivity activity = (MainActivity) bridge.getActivity();
        if (activity == null) return;

        // On watch pages, inject a smart listener to disable timers on first interaction.
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
    
    /**
     * Inject JavaScript to capture streams via Fetch/XHR interception
     * This is the third capture method - catches streams shouldInterceptRequest misses
     */
    private void injectStreamCaptureScript(WebView view) {
        String captureScript = 
            "(function() {" +
            "  if (window.__hlsCaptureInstalled) return;" +
            "  window.__hlsCaptureInstalled = true;" +
            "" +
            "  function captureStream(url) {" +
            "    if (url && (url.includes('.m3u8') || url.includes('/pl/') || url.includes('/hls/') || url.includes('/manifest'))) {" +
            "      console.log('[HLS-CAPTURE-JS] Captured:', url.substring(0, 100));" +
            "      if (window.Capacitor) {" +
            "        window.Capacitor.Plugins.HLSDownloader.captureStream({ url: url }).catch(() => {});" +
            "      }" +
            "    }" +
            "  }" +
            "" +
            "  // Capture fetch requests" +
            "  const originalFetch = window.fetch;" +
            "  window.fetch = function(...args) {" +
            "    const url = args[0];" +
            "    const urlStr = typeof url === 'string' ? url : url.url;" +
            "    captureStream(urlStr);" +
            "    return originalFetch.apply(this, args);" +
            "  };" +
            "" +
            "  // Capture XMLHttpRequest" +
            "  const originalXhrOpen = XMLHttpRequest.prototype.open;" +
            "  XMLHttpRequest.prototype.open = function(method, url, ...args) {" +
            "    captureStream(url);" +
            "    return originalXhrOpen.apply(this, [method, url, ...args]);" +
            "  };" +
            "" +
            "  // Capture src attribute changes on video/audio elements" +
            "  const observer = new MutationObserver(function(mutations) {" +
            "    mutations.forEach(function(mutation) {" +
            "      if (mutation.target.tagName === 'SOURCE') {" +
            "        captureStream(mutation.target.src);" +
            "      }" +
            "    });" +
            "  });" +
            "" +
            "  observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['src'] });" +
            "  console.log('[HLS-CAPTURE-JS] Stream capture interceptors installed');" +
            "})();";
        
        try {
            view.evaluateJavascript(captureScript, null);
            Log.d(TAG, "? Stream capture script injected with Capacitor bridge");
        } catch (Exception e) {
            Log.e(TAG, "Error injecting capture script: " + e.getMessage());
        }
    }
}
