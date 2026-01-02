/**
 * Stream Capture Initialization
 * 
 * CRITICAL: This file runs at APPLICATION STARTUP, before any components mount.
 * It defines the global handlers that native code (ReelViewWebViewClient.java) 
 * will call when it intercepts HLS streams.
 * 
 * This MUST be imported in the main App before any routes render.
 */

// Initialize global list - will be populated by native stream capture
(window as any).__reelviewCapturedStreams = (window as any).__reelviewCapturedStreams || [];

console.log('[STREAM-CAPTURE-INIT] ? Global __reelviewCapturedStreams initialized');

/**
 * Global handler called by native code (ReelViewWebViewClient.java)
 * when it intercepts an HLS stream.
 * 
 * Native code calls:
 * view.evaluateJavascript("if (window.__reelviewStreamCapture) { window.__reelviewStreamCapture('URL'); }")
 */
(window as any).__reelviewStreamCapture = async (url: string) => {
  try {
    console.log('[STREAM-CAPTURE-HANDLER] Called by native code');
    console.log('[STREAM-CAPTURE-HANDLER] URL:', url.substring(0, 100));
    
    // Get the global list
    const streams = (window as any).__reelviewCapturedStreams;
    
    if (!Array.isArray(streams)) {
      console.error('[STREAM-CAPTURE-HANDLER] ERROR: __reelviewCapturedStreams is not an array!', typeof streams);
      return;
    }
    
    // Check if already captured
    if (streams.includes(url)) {
      console.log('[STREAM-CAPTURE-HANDLER] ? Already captured, skipping duplicate');
      return;
    }
    
    // Add to front of list
    streams.unshift(url);
    
    // Keep list limited to 10 items
    if (streams.length > 10) {
      streams.pop();
    }
    
    console.log('[STREAM-CAPTURE-HANDLER] ? Stream stored successfully');
    console.log('[STREAM-CAPTURE-HANDLER] Total streams now:', streams.length);
    console.log('[STREAM-CAPTURE-HANDLER] Streams list:', streams.map((s: string) => s.substring(0, 60)));
    
  } catch (error) {
    console.error('[STREAM-CAPTURE-HANDLER] Error processing stream:', error);
  }
};

console.log('[STREAM-CAPTURE-INIT] ? Global __reelviewStreamCapture handler defined');
console.log('[STREAM-CAPTURE-INIT] ? Stream capture initialization COMPLETE');
