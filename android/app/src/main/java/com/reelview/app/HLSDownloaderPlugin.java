package com.reelview.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "HLSDownloader")
public class HLSDownloaderPlugin extends Plugin {
    
    private static final String TAG = "HLSDownloaderPlugin";
    private static HLSDownloaderPlugin instance;
    private HLSDownloader hlsDownloader;
    private Map<String, DownloadState> downloads = new ConcurrentHashMap<>();
    private List<String> capturedStreams = Collections.synchronizedList(new ArrayList<>());
    private Map<String, JSONArray> streamVariantsCache = new ConcurrentHashMap<>();
    
    private static class DownloadState {
        String id, filename, url, quality, status, filePath, error;
        String estimatedQuality;
        double bitrateMbps;
        int progress;
        long downloadedBytes, startTime;
    }

    @Override
    public void load() {
        hlsDownloader = new HLSDownloader(getContext());
        instance = this;
        
        PendingStreamCapture.processPendingStreams(this);
        loadDownloadsFromPreferences();
        Log.d(TAG, "HLSDownloaderPlugin loaded");
    }
    
    public static HLSDownloaderPlugin getInstance() {
        return instance;
    }
    
    public synchronized void storeCapturedStream(String url, String source) {
        if (url == null || url.isEmpty() || capturedStreams.contains(url)) return;

        capturedStreams.add(0, url);
        if (capturedStreams.size() > 10) {
            capturedStreams.remove(capturedStreams.size() - 1);
        }
        Log.d(TAG, "[HLS-CAPTURE] Captured stream (" + source + "): " + url.substring(0, Math.min(100, url.length())));

        new Thread(() -> {
            try {
                JSONArray variants = parseM3U8Variants(url);
                if (variants.length() > 0) {
                    streamVariantsCache.put(url, variants);
                    Log.d(TAG, "Pre-cached " + variants.length() + " variants for URL.");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to pre-cache variants: " + e.getMessage());
            }
        }).start();

        notifyListeners("stream-captured", new JSObject().put("url", url));
    }

    public void captureStreamFromNative(String url) {
        storeCapturedStream(url, "native");
    }
    
    @PluginMethod
    public void getQualityVariants(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        if (streamVariantsCache.containsKey(url)) {
            JSObject result = new JSObject().put("variants", streamVariantsCache.get(url));
            call.resolve(result);
            return;
        }

        new Thread(() -> {
            try {
                JSONArray variants = parseM3U8Variants(url);
                if (variants.length() == 0) {
                    variants.put(new JSObject().put("url", url).put("label", "Default Quality"));
                }
                JSObject result = new JSObject().put("variants", variants);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "On-demand variant parse failed: " + e.getMessage());
                try {
                    call.resolve(new JSObject().put("variants", new JSONArray()
                        .put(new JSObject().put("url", url).put("label", "Default Quality"))));
                } catch(Exception e2) {
                    call.reject(e.getMessage());
                }
            }
        }).start();
    }
    
    private JSONArray parseM3U8Variants(String m3u8Url) throws Exception {
        JSONArray variants = new JSONArray();
        java.net.URL url = new java.net.URL(m3u8Url);
        java.net.URLConnection conn = url.openConnection();
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10)");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        
        StringBuilder content = new StringBuilder();
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
        }
        
        String playlist = content.toString();
        String[] lines = playlist.split("\n");
        
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            
            if (line.startsWith("#EXT-X-STREAM-INF:")) {
                int bandwidth = 0;
                String resolution = null;
                
                if (line.contains("BANDWIDTH=")) {
                    try {
                        String bwStr = line.substring(line.indexOf("BANDWIDTH=") + 10);
                        if (bwStr.contains(",")) {
                            bwStr = bwStr.substring(0, bwStr.indexOf(","));
                        }
                        bandwidth = Integer.parseInt(bwStr.trim());
                    } catch (Exception ignored) {}
                }
                
                if (line.contains("RESOLUTION=")) {
                    try {
                        String resStr = line.substring(line.indexOf("RESOLUTION=") + 11);
                        if (resStr.contains(",")) {
                            resStr = resStr.substring(0, resStr.indexOf(","));
                        }
                        resolution = resStr.trim();
                    } catch (Exception ignored) {}
                }
                
                if (i + 1 < lines.length) {
                    String variantUrl = lines[i + 1].trim();
                    if (!variantUrl.isEmpty() && !variantUrl.startsWith("#")) {
                        if (!variantUrl.startsWith("http")) {
                            try {
                                java.net.URL base = new java.net.URL(m3u8Url);
                                java.net.URL resolved = new java.net.URL(base, variantUrl);
                                variantUrl = resolved.toString();
                            } catch (Exception ignored) {}
                        }
                        
                        JSObject variant = new JSObject();
                        variant.put("url", variantUrl);
                        variant.put("bandwidth", bandwidth);
                        
                        String label;
                        if (resolution != null) {
                            if (resolution.contains("x")) {
                                String height = resolution.substring(resolution.indexOf("x") + 1);
                                label = height + "p";
                            } else {
                                label = resolution;
                            }
                            variant.put("resolution", label);
                        } else if (bandwidth > 0) {
                            if (bandwidth > 5000000) label = "1080p";
                            else if (bandwidth > 2500000) label = "720p";
                            else if (bandwidth > 1000000) label = "480p";
                            else label = "360p";
                            variant.put("resolution", label);
                        } else {
                            label = "Auto";
                        }
                        variant.put("label", label);
                        
                        variants.put(variant);
                    }
                }
            }
        }
        
        return variants;
    }

    @PluginMethod
    public void getCapturedStreams(PluginCall call) {
        try {
            Log.d(TAG, "getCapturedStreams called - Current count: " + capturedStreams.size());
            
            if (capturedStreams.isEmpty()) {
                Log.w(TAG, "? NO CAPTURED STREAMS - Check ReelViewWebViewClient logs for interception");
            }
            
            JSONArray streams = new JSONArray();
            for (String url : capturedStreams) {
                Log.d(TAG, "  Including stream: " + url.substring(0, Math.min(100, url.length())));
                
                JSONObject stream = new JSONObject();
                stream.put("url", url);
                stream.put("type", "hls");
                stream.put("timestamp", System.currentTimeMillis());
                
                // Include cached variants if available
                if (streamVariantsCache.containsKey(url)) {
                    stream.put("variants", streamVariantsCache.get(url));
                }
                
                streams.put(stream);
            }
            
            Log.d(TAG, "getCapturedStreams returning " + streams.length() + " streams");
            call.resolve(new JSObject().put("streams", streams));
        } catch (Exception e) {
            Log.e(TAG, "Error in getCapturedStreams: " + e.getMessage());
            call.resolve(new JSObject().put("streams", new JSONArray()));
        }
    }
    
    private void saveDownloadsToPreferences() {
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("reelview_downloads", android.content.Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            JSONArray downloadsJson = new JSONArray();
            for (DownloadState state : downloads.values()) {
                downloadsJson.put(new JSONObject()
                    .put("id", state.id)
                    .put("filename", state.filename)
                    .put("url", state.url)
                    .put("quality", state.quality)
                    .put("status", state.status)
                    .put("progress", state.progress)
                    .put("downloadedBytes", state.downloadedBytes)
                    .put("filePath", state.filePath)
                    .put("error", state.error)
                    .put("startTime", state.startTime));
            }
            editor.putString("downloads_list", downloadsJson.toString());
            editor.apply();
        } catch (Exception e) {
            Log.e(TAG, "Error saving downloads", e);
        }
    }

    private void loadDownloadsFromPreferences() {
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("reelview_downloads", android.content.Context.MODE_PRIVATE);
            String downloadsJson = prefs.getString("downloads_list", "[]");
            JSONArray array = new JSONArray(downloadsJson);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                DownloadState state = new DownloadState();
                state.id = obj.getString("id");
                state.filename = obj.getString("filename");
                state.url = obj.getString("url");
                state.quality = obj.optString("quality");
                state.status = obj.getString("status");
                state.progress = obj.getInt("progress");
                state.downloadedBytes = obj.getLong("downloadedBytes");
                state.filePath = obj.optString("filePath");
                state.error = obj.optString("error");
                state.startTime = obj.getLong("startTime");
                downloads.put(state.id, state);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error loading downloads", e);
        }
    }
    
    @PluginMethod
    public void startDownload(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename");
        String quality = call.getString("quality");
        
        if (url == null || filename == null) {
            call.reject("URL and filename are required");
            return;
        }
        
        String downloadId = "dl-" + System.currentTimeMillis();
        DownloadState state = new DownloadState();
        state.id = downloadId;
        state.filename = filename;
        state.url = url;
        state.quality = quality;
        state.status = "fetching";
        state.startTime = System.currentTimeMillis();
        downloads.put(downloadId, state);
        
        Log.d(TAG, "Starting download: " + downloadId + " for " + filename);
        
        saveDownloadsToPreferences();
        notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("downloadId", downloadId);
        call.resolve(result);
        
        // CRITICAL: Start download via Foreground Service to survive screen lock & app backgrounding
        // This replaces the background thread approach
        Intent downloadIntent = new Intent(getContext(), DownloadService.class);
        downloadIntent.setAction("DOWNLOAD");
        downloadIntent.putExtra("downloadId", downloadId);
        downloadIntent.putExtra("url", url);
        downloadIntent.putExtra("quality", quality);
        downloadIntent.putExtra("filename", filename);
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8+ requires startForegroundService for foreground services
                getContext().startForegroundService(downloadIntent);
                Log.d(TAG, "Download started via foreground service: " + downloadId);
            } else {
                getContext().startService(downloadIntent);
                Log.d(TAG, "Download started via service: " + downloadId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service: " + e.getMessage());
            // Fallback to thread-based download if service fails
            startDownloadThread(downloadId, url, quality, filename, state);
        }
    }
    
    /**
     * Fallback: Start download in background thread if service unavailable
     */
    private void startDownloadThread(String downloadId, String url, String quality, String filename, DownloadState state) {
        new Thread(() -> {
            try {
                Log.d(TAG, "Download thread started (fallback) for " + downloadId);
                
                hlsDownloader.downloadStream(url, quality, filename, new HLSDownloader.DownloadProgressCallback() {
                    @Override
                    public void onProgress(String status, int progress, String estimatedQuality, double bitrateMbps) {
                        state.status = mapStatus(status);
                        state.progress = progress;
                        state.estimatedQuality = estimatedQuality;
                        state.bitrateMbps = bitrateMbps;
                        
                        Log.d(TAG, String.format("Progress: %s - %d%% - Quality: %s @ %.1f Mbps", 
                            status, progress, estimatedQuality, bitrateMbps));
                        
                        saveDownloadsToPreferences();
                        
                        try {
                            notifyListeners("download-progress", createProgressObject(state));
                            notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
                        } catch (Exception e) {
                            Log.e(TAG, "Error notifying progress: " + e.getMessage());
                        }
                    }
                    
                    @Override
                    public void onFileReady(String filePath, String estimatedQuality, double bitrateMbps) {
                        state.status = "complete";
                        state.progress = 100;
                        state.filePath = filePath;
                        state.estimatedQuality = estimatedQuality;
                        state.bitrateMbps = bitrateMbps;
                        
                        File file = new File(filePath);
                        if (file.exists()) {
                            state.downloadedBytes = file.length();
                        }
                        
                        Log.d(TAG, String.format("Download complete: %s - Quality: %s @ %.2f Mbps", 
                            filePath, estimatedQuality, bitrateMbps));
                        
                        saveDownloadsToPreferences();
                        
                        try {
                            notifyListeners("download-complete", createProgressObject(state));
                            notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
                        } catch (Exception e) {
                            Log.e(TAG, "Error notifying completion: " + e.getMessage());
                        }
                    }
                    
                    @Override
                    public void onError(String error) {
                        state.status = "error";
                        state.error = error;
                        Log.e(TAG, "Download error: " + error);
                        
                        saveDownloadsToPreferences();
                        
                        try {
                            notifyListeners("download-error", createProgressObject(state));
                            notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
                        } catch (Exception e) {
                            Log.e(TAG, "Error notifying failure: " + e.getMessage());
                        }
                    }
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Download thread exception for " + downloadId + ": " + e.getMessage(), e);
                state.status = "error";
                state.error = e.getMessage();
                saveDownloadsToPreferences();
                try {
                    notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
                } catch (Exception ex) {
                    Log.e(TAG, "Error notifying error: " + ex.getMessage());
                }
            }
        }, "DownloadThread-" + downloadId).start();
    }
    
    private String mapStatus(String status) {
        if (status == null) return "unknown";
        switch (status.toLowerCase()) {
            case "fetching playlist": return "fetching";
            case "analyzing":
            case "analyzing segments": return "parsing";
            case "downloading": return "downloading";
            case "merging segments": return "merging";
            case "converting to mkv": return "converting";
            case "complete": return "complete";
            default: return status;
        }
    }
    
    private JSObject createProgressObject(DownloadState state) {
        JSObject obj = new JSObject();
        obj.put("id", state.id);
        obj.put("status", state.status);
        obj.put("progress", state.progress);
        obj.put("downloadedBytes", state.downloadedBytes);
        obj.put("estimatedQuality", state.estimatedQuality != null ? state.estimatedQuality : "");
        obj.put("bitrateMbps", state.bitrateMbps);
        if (state.filePath != null) obj.put("filePath", state.filePath);
        if (state.error != null) obj.put("error", state.error);
        return obj;
    }
    
    private JSONArray createDownloadsArray() {
        JSONArray array = new JSONArray();
        for (DownloadState state : downloads.values()) {
            try {
                JSONObject obj = new JSONObject();
                obj.put("id", state.id);
                obj.put("filename", state.filename);
                obj.put("url", state.url);
                obj.put("quality", state.quality != null ? state.quality : "");
                obj.put("status", state.status);
                obj.put("progress", state.progress);
                obj.put("downloadedBytes", state.downloadedBytes);
                obj.put("estimatedQuality", state.estimatedQuality != null ? state.estimatedQuality : "");
                obj.put("bitrateMbps", state.bitrateMbps);
                obj.put("filePath", state.filePath != null ? state.filePath : "");
                obj.put("error", state.error != null ? state.error : "");
                obj.put("startTime", state.startTime);
                array.put(obj);
            } catch (Exception e) {
                Log.e(TAG, "Error creating download object: " + e.getMessage());
            }
        }
        return array;
    }
    
    @PluginMethod
    public void getDownloadsList(PluginCall call) {
        try {
            call.resolve(new JSObject().put("downloads", createDownloadsArray()));
        } catch (Exception e) {
            Log.e(TAG, "Error getting downloads list: " + e.getMessage());
            call.resolve(new JSObject().put("downloads", new JSONArray()));
        }
    }
    
    @PluginMethod
    public void clearCompletedDownloads(PluginCall call) {
        try {
            List<String> toRemove = new ArrayList<>();
            for (Map.Entry<String, DownloadState> entry : downloads.entrySet()) {
                String status = entry.getValue().status;
                if ("complete".equals(status) || "error".equals(status) || "cancelled".equals(status)) {
                    toRemove.add(entry.getKey());
                }
            }
            for (String id : toRemove) {
                downloads.remove(id);
            }
            saveDownloadsToPreferences();
            notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Error clearing downloads: " + e.getMessage());
            call.resolve(new JSObject().put("success", false));
        }
    }
    
    @PluginMethod
    public void removeDownload(PluginCall call) {
        try {
            String id = call.getString("id");
            boolean deleteFile = call.getBoolean("deleteFile", false);
            
            if (id != null && downloads.containsKey(id)) {
                DownloadState state = downloads.get(id);
                
                if (deleteFile && state != null && state.filePath != null) {
                    try {
                        File file = new File(state.filePath);
                        if (file.exists()) {
                            boolean deleted = file.delete();
                            Log.d(TAG, "File deletion " + (deleted ? "successful" : "failed") + ": " + state.filePath);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error deleting file: " + e.getMessage());
                    }
                }
                
                downloads.remove(id);
                saveDownloadsToPreferences();
                notifyListeners("downloads-updated", new JSObject().put("downloads", createDownloadsArray()));
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Error removing download: " + e.getMessage());
            call.resolve(new JSObject().put("success", false));
        }
    }
    
    @PluginMethod
    public void captureStream(PluginCall call) {
        try {
            String url = call.getString("url");
            if (url == null || url.isEmpty()) {
                call.reject("URL is required");
                return;
            }
            
            storeCapturedStream(url, "javascript");
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("count", capturedStreams.size());
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error capturing stream: " + e.getMessage());
            call.reject(e.getMessage());
        }
    }
    
    @PluginMethod
    public void clearStreams(PluginCall call) {
        try {
            capturedStreams.clear();
            streamVariantsCache.clear();
            Log.d(TAG, "Cleared captured streams");
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Error clearing streams: " + e.getMessage());
            call.resolve(new JSObject().put("success", false));
        }
    }
}
