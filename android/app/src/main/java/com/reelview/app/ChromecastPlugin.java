package com.reelview.app;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.cast.CastDevice;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.common.images.WebImage;
import org.json.JSONObject;

import android.net.Uri;

/**
 * Chromecast Plugin using Static Website Intermediary
 * 
 * The intermediary (chromecast-intermediary.html) is responsible for:
 * 1. Accepting stream URL + headers
 * 2. Loading the M3U8 playlist with authentication headers
 * 3. Using HLS.js to inject headers into all segment requests
 * 4. Playing the authenticated stream
 * 
 * This plugin acts as a bridge to send the stream data to the intermediary
 */
@CapacitorPlugin(name = "Chromecast")
public class ChromecastPlugin extends Plugin {
    
    private static final String TAG = "ChromecastPlugin";
    
    // URL to the static intermediary website hosted on GitHub Pages
    private static final String INTERMEDIARY_URL = "https://cdn.jsdelivr.net/gh/FoggyGoofball/reelview-spa@main/docs/chromecast-intermediary.html";
    
    private CastContext castContext;
    private SessionManager sessionManager;
    private CastSession currentSession;
    
    private String pendingStreamUrl;
    private JSONObject pendingHeaders;
    private String pendingTitle;
    private String pendingImageUrl;
    private PluginCall pendingCall;
    
    private final SessionManagerListener<CastSession> sessionListener = new SessionManagerListener<CastSession>() {
        @Override
        public void onSessionStarted(CastSession session, String sessionId) {
            Log.d(TAG, "? Session STARTED: " + sessionId);
            currentSession = session;
            
            if (pendingStreamUrl != null) {
                Log.d(TAG, "Loading pending stream on established session");
                loadMediaOnSession(session, pendingStreamUrl, pendingTitle, pendingImageUrl, pendingHeaders, pendingCall);
                clearPending();
            }
        }

        @Override
        public void onSessionEnded(CastSession session, int error) {
            Log.d(TAG, "Session ended");
            currentSession = null;
        }

        @Override
        public void onSessionResuming(CastSession session, String sessionId) {}

        @Override
        public void onSessionResumed(CastSession session, boolean wasSuspended) {
            currentSession = session;
        }

        @Override
        public void onSessionSuspended(CastSession session, int reason) {}
        
        @Override
        public void onSessionStarting(CastSession session) {}
        
        @Override
        public void onSessionEnding(CastSession session) {}
        
        @Override
        public void onSessionStartFailed(CastSession session, int error) {}
        
        @Override
        public void onSessionResumeFailed(CastSession session, int error) {}
    };

    @Override
    public void load() {
        Log.d(TAG, "ChromecastPlugin loaded");
        try {
            castContext = CastContext.getSharedInstance(getContext());
            sessionManager = castContext.getSessionManager();
            
            Log.d(TAG, "? Adding session listener");
            sessionManager.addSessionManagerListener(sessionListener, CastSession.class);
            Log.d(TAG, "? Session listener registered");
        } catch (Exception e) {
            Log.e(TAG, "Init failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        Log.d(TAG, "initialize() called");
        call.resolve(new JSObject().put("initialized", true));
    }

    @PluginMethod
    public void cast(PluginCall call) {
        try {
            String url = call.getString("url");
            String title = call.getString("title", "Casting...");
            String imageUrl = call.getString("imageUrl");
            String headersJson = call.getString("headersJson", "{}");
            
            Log.d(TAG, "=== CAST REQUEST ===");
            Log.d(TAG, "Stream URL: " + url);
            Log.d(TAG, "Title: " + title);
            Log.d(TAG, "Headers: " + headersJson);
            
            if (url == null || url.isEmpty()) {
                call.reject("Stream URL is required");
                return;
            }

            JSONObject headers = new JSONObject(headersJson);
            
            // Store pending info
            pendingStreamUrl = url;
            pendingTitle = title;
            pendingImageUrl = imageUrl;
            pendingHeaders = headers;
            pendingCall = call;

            // Check if already connected
            CastSession session = sessionManager.getCurrentCastSession();
            if (session != null && session.isConnected()) {
                Log.d(TAG, "Already connected, loading immediately");
                loadMediaOnSession(session, url, title, imageUrl, headers, call);
                clearPending();
            } else {
                Log.d(TAG, "Not connected, waiting for session...");
                // Session listener will handle loading when connected
            }
        } catch (Exception e) {
            Log.e(TAG, "cast() error: " + e.getMessage());
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (currentSession != null) {
                sessionManager.endCurrentSession(true);
                currentSession = null;
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private void loadMediaOnSession(CastSession session, String streamUrl, String title, 
                                   String imageUrl, JSONObject headers, PluginCall call) {
        try {
            RemoteMediaClient remoteMediaClient = session.getRemoteMediaClient();
            if (remoteMediaClient == null) {
                Log.e(TAG, "Remote media client unavailable");
                if (call != null) call.reject("Remote media client unavailable");
                return;
            }

            // Build URL to intermediary with stream info as query parameters
            String intermediaryUrl = buildIntermediaryUrl(streamUrl, headers);
            
            Log.d(TAG, "Intermediary URL: " + intermediaryUrl);

            // Build metadata
            MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);
            metadata.putString(MediaMetadata.KEY_TITLE, title);
            if (imageUrl != null && !imageUrl.isEmpty()) {
                try {
                    metadata.addImage(new WebImage(Uri.parse(imageUrl)));
                } catch (Exception e) {
                    Log.d(TAG, "Image URL parse error: " + e.getMessage());
                }
            }

            // Load the intermediary as HLS content
            MediaInfo mediaInfo = new MediaInfo.Builder(intermediaryUrl)
                    .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                    .setContentType("text/html")
                    .setMetadata(metadata)
                    .build();

            MediaLoadRequestData loadRequest = new MediaLoadRequestData.Builder()
                    .setMediaInfo(mediaInfo)
                    .setAutoplay(true)
                    .build();

            remoteMediaClient.load(loadRequest).setResultCallback(result -> {
                if (result.getStatus().isSuccess()) {
                    Log.d(TAG, "? Media loaded successfully");
                    if (call != null) {
                        JSObject response = new JSObject();
                        response.put("success", true);
                        response.put("deviceName", session.getCastDevice().getFriendlyName());
                        call.resolve(response);
                    }
                } else {
                    Log.e(TAG, "? Media load failed: " + result.getStatus().getStatusMessage());
                    if (call != null) {
                        call.reject(result.getStatus().getStatusMessage());
                    }
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "loadMediaOnSession error: " + e.getMessage());
            if (call != null) call.reject(e.getMessage());
        }
    }

    private String buildIntermediaryUrl(String streamUrl, JSONObject headers) {
        try {
            // Encode headers as JSON in URL parameter
            String headersParam = headers.toString();
            
            // Build intermediary URL with stream info as query params
            String url = INTERMEDIARY_URL + 
                    "?url=" + Uri.encode(streamUrl) +
                    "&headers=" + Uri.encode(headersParam);
            
            Log.d(TAG, "Built intermediary URL with " + headers.length() + " headers");
            return url;
        } catch (Exception e) {
            Log.e(TAG, "Failed to build intermediary URL: " + e.getMessage());
            // Fallback to basic URL
            return INTERMEDIARY_URL + "?url=" + Uri.encode(streamUrl);
        }
    }

    private void clearPending() {
        pendingStreamUrl = null;
        pendingHeaders = null;
        pendingTitle = null;
        pendingImageUrl = null;
        pendingCall = null;
    }
}
