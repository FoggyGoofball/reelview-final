package com.reelview.app;

import android.util.Log;
import java.util.ArrayList;
import java.util.List;

/**
 * Temporary queue for stream URLs captured before HLSDownloaderPlugin is fully loaded
 */
public class PendingStreamCapture {
    private static final String TAG = "PendingStreamCapture";
    private static final List<String> pendingStreams = new ArrayList<>();
    
    /**
     * Add a stream URL to the pending queue
     */
    public static synchronized void queueStream(String url) {
        if (url == null || url.isEmpty()) return;
        pendingStreams.add(url);
        Log.d(TAG, "Queued stream for later: " + url.substring(0, Math.min(80, url.length())));
    }
    
    /**
     * Get all pending streams and clear the queue
     */
    public static synchronized List<String> getPendingStreams() {
        List<String> streams = new ArrayList<>(pendingStreams);
        pendingStreams.clear();
        if (!streams.isEmpty()) {
            Log.d(TAG, "Retrieved " + streams.size() + " pending streams");
        }
        return streams;
    }
    
    /**
     * Process pending streams when plugin becomes available
     */
    public static synchronized void processPendingStreams(HLSDownloaderPlugin plugin) {
        if (plugin == null) return;
        
        List<String> pending = getPendingStreams();
        for (String url : pending) {
            plugin.captureStreamFromNative(url);
            Log.d(TAG, "? Processed pending stream: " + url.substring(0, Math.min(80, url.length())));
        }
    }
}
