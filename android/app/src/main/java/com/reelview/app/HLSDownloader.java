package com.reelview.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.util.Log;
import android.webkit.CookieManager;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.GZIPInputStream;

/**
 * HLS Stream Downloader for Android
 * Uses WakeLock to prevent Doze mode from interrupting downloads
 * Includes quality estimation from bitrate analysis
 */
public class HLSDownloader {
    private static final String TAG = "HLSDownloader";
    private static final int BUFFER_SIZE = 8192;
    private static final int TIMEOUT = 30000;
    private Context context;
    private boolean ffmpegAvailable = false;
    private String ffmpegPath = "";
    private PowerManager.WakeLock wakeLock;
    
    // Quality estimation fields
    private double totalDuration = 0;
    private String estimatedQuality = "";
    private double bitrateMbps = 0;

    public HLSDownloader(Context context) {
        this.context = context;
        checkFFmpegAvailability();
        initializeWakeLock();
    }

    /**
     * Initialize WakeLock to keep device awake during download
     * Uses FULL_WAKE_LOCK to ensure CPU stays awake even in low-power modes
     */
    private void initializeWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                // PARTIAL_WAKE_LOCK: keeps CPU awake but allows screen to turn off (preferred for downloads)
                // FULL_WAKE_LOCK: keeps CPU + screen awake (only use if needed)
                // ACQUIRE_CAUSES_WAKEUP: wakes device from doze mode
                
                // For downloads: PARTIAL_WAKE_LOCK is sufficient since we don't need the screen on
                int lockType = PowerManager.PARTIAL_WAKE_LOCK;
                
                // Add ACQUIRE_CAUSES_WAKEUP flag to wake from Doze if download is pending
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // On Android 6+, also request to override power-saving modes
                    // Note: This requires IGNORE_BATTERY_OPTIMIZATIONS permission in manifest
                    lockType |= PowerManager.ACQUIRE_CAUSES_WAKEUP;
                }
                
                wakeLock = powerManager.newWakeLock(lockType, "reelview:download");
                
                // Set timeout to 30 minutes max per download (prevent runaway)
                // Downloads longer than this will need to manage their own WakeLock re-acquisition
                wakeLock.acquire(30 * 60 * 1000L);
                
                Log.d(TAG, "WakeLock acquired with flags: " + lockType);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing WakeLock: " + e.getMessage());
            // Proceed without WakeLock if there's an error
        }
    }

    /**
     * Release WakeLock when done
     */
    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "WakeLock released");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing WakeLock: " + e.getMessage());
        }
    }

    private void checkFFmpegAvailability() {
        try {
            ProcessBuilder pb = new ProcessBuilder("ffmpeg", "-version");
            Process p = pb.start();
            int exitCode = p.waitFor();
            ffmpegAvailable = (exitCode == 0);
            ffmpegPath = "ffmpeg";
            Log.d(TAG, "FFmpeg available: " + ffmpegAvailable);
        } catch (Exception e) {
            Log.d(TAG, "FFmpeg not available (expected on Android)");
            ffmpegAvailable = false;
        }
    }

    /**
     * Download content using WebView cookies and with WakeLock
     */
    private String downloadContent(String urlString) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(TIMEOUT);
        connection.setReadTimeout(TIMEOUT);
        connection.setInstanceFollowRedirects(false);
        
        CookieManager cookieManager = CookieManager.getInstance();
        String cookies = cookieManager.getCookie(urlString);
        if (cookies != null) {
            Log.d(TAG, "Adding cookies to request");
            connection.setRequestProperty("Cookie", cookies);
        }
        
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        connection.setRequestProperty("Accept", "*/*");
        connection.setRequestProperty("Accept-Encoding", "gzip, deflate");
        connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
        connection.setRequestProperty("Connection", "keep-alive");
        
        try {
            int responseCode = connection.getResponseCode();
            Log.d(TAG, "Response code: " + responseCode);
            
            // Handle redirects
            if (responseCode == 301 || responseCode == 302) {
                String location = connection.getHeaderField("Location");
                if (location != null) {
                    Log.d(TAG, "Following redirect");
                    connection.disconnect();
                    return downloadContent(location);
                }
            }
            
            if (responseCode != 200 && responseCode != 206) {
                throw new IOException("HTTP " + responseCode);
            }
            
            // Decompress if needed
            InputStream inputStream = connection.getInputStream();
            String contentEncoding = connection.getHeaderField("Content-Encoding");
            
            if ("gzip".equalsIgnoreCase(contentEncoding)) {
                inputStream = new GZIPInputStream(inputStream);
            }
            
            BufferedInputStream buffered = new BufferedInputStream(inputStream);
            StringBuilder content = new StringBuilder();
            byte[] buffer = new byte[BUFFER_SIZE];
            int nRead;
            int totalBytes = 0;
            
            while ((nRead = buffered.read(buffer)) != -1) {
                content.append(new String(buffer, 0, nRead, "UTF-8"));
                totalBytes += nRead;
            }
            
            buffered.close();
            inputStream.close();
            
            String result = content.toString();
            Log.d(TAG, "Downloaded " + totalBytes + " bytes");
            
            // Validate m3u8
            if (result.contains("<!DOCTYPE") || result.contains("<html")) {
                Log.e(TAG, "Got HTML instead of m3u8!");
                throw new IOException("Server returned HTML instead of m3u8");
            }
            
            if (result.length() < 50) {
                throw new IOException("Response too short");
            }
            
            if (!result.contains("#EXTM3U") && !result.contains("EXTINF")) {
                throw new IOException("Invalid m3u8 format");
            }
            
            Log.d(TAG, "? Valid m3u8");
            return result;
            
        } finally {
            connection.disconnect();
        }
    }

    /**
     * Download binary segment with WakeLock
     */
    private byte[] downloadSegment(String urlString) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(TIMEOUT);
        connection.setReadTimeout(TIMEOUT);
        
        CookieManager cookieManager = CookieManager.getInstance();
        String cookies = cookieManager.getCookie(urlString);
        if (cookies != null) {
            connection.setRequestProperty("Cookie", cookies);
        }
        
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        connection.setRequestProperty("Accept", "*/*");
        
        try {
            int responseCode = connection.getResponseCode();
            if (responseCode != 200 && responseCode != 206) {
                throw new IOException("HTTP " + responseCode);
            }
            
            InputStream inputStream = connection.getInputStream();
            BufferedInputStream buffered = new BufferedInputStream(inputStream);
            
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] data = new byte[BUFFER_SIZE];
            int nRead;
            
            while ((nRead = buffered.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            
            buffered.close();
            inputStream.close();
            
            return buffer.toByteArray();
            
        } finally {
            connection.disconnect();
        }
    }

    /**
     * Merge TS segments
     */
    private File mergeSegments(List<byte[]> segments, String outputPath) throws IOException {
        File output = new File(outputPath);
        try (FileOutputStream fos = new FileOutputStream(output);
             BufferedOutputStream bos = new BufferedOutputStream(fos)) {
            
            for (byte[] segment : segments) {
                bos.write(segment);
            }
            bos.flush();
        }
        
        Log.d(TAG, "? Merged " + segments.size() + " segments: " + (output.length() / 1024 / 1024) + " MB");
        return output;
    }

    /**
     * Convert TS to MKV
     */
    private File convertToMKV(File tsFile, String mkvPath) {
        if (!ffmpegAvailable) {
            File mkvFile = new File(mkvPath);
            if (tsFile.renameTo(mkvFile)) {
                Log.d(TAG, "? Renamed to MKV");
                return mkvFile;
            }
            return tsFile;
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                ffmpegPath, "-i", tsFile.getAbsolutePath(),
                "-c", "copy", "-movflags", "+faststart", "-y", mkvPath
            );
            
            Process p = pb.start();
            int exitCode = p.waitFor();
            
            if (exitCode == 0) {
                File mkvFile = new File(mkvPath);
                if (mkvFile.exists()) {
                    Log.d(TAG, "? MKV conversion complete");
                    tsFile.delete();
                    return mkvFile;
                }
            }
            return tsFile;
            
        } catch (Exception e) {
            Log.e(TAG, "FFmpeg error: " + e.getMessage());
            return tsFile;
        }
    }

    /**
     * Estimate quality from bitrate (matches Electron implementation)
     */
    private String estimateQualityFromBitrate(double mbps) {
        if (mbps >= 8) return "1080p";
        if (mbps >= 4) return "720p";
        if (mbps >= 2) return "480p";
        if (mbps >= 1) return "360p";
        return "240p";
    }

    /**
     * Calculate bitrate and estimate quality from file size and duration
     */
    private void calculateQualityEstimate(long fileSizeBytes, double durationSeconds) {
        if (durationSeconds > 0) {
            double bitrateBps = (fileSizeBytes * 8.0) / durationSeconds;
            bitrateMbps = bitrateBps / 1000000.0;
            estimatedQuality = estimateQualityFromBitrate(bitrateMbps);
            Log.d(TAG, String.format("Quality estimation: %d bytes, %.1fs = %.2f Mbps = %s", 
                fileSizeBytes, durationSeconds, bitrateMbps, estimatedQuality));
        }
    }

    /**
     * Download HLS stream with WakeLock active and quality estimation
     */
    public String downloadStream(
            String m3u8Url,
            String quality,
            String fileName,
            DownloadProgressCallback progressCallback) throws IOException {
        
        // Reset quality estimation
        totalDuration = 0;
        estimatedQuality = "";
        bitrateMbps = 0;
        
        // Use the public Downloads directory so files are visible in file managers
        File downloadsDir;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ - use app-specific downloads (still visible in Downloads)
            downloadsDir = new File(Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS), "ReelView");
        } else {
            // Older Android - direct access to Downloads
            downloadsDir = new File(Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS), "ReelView");
        }
        
        if (!downloadsDir.exists()) {
            boolean created = downloadsDir.mkdirs();
            Log.d(TAG, "Created ReelView downloads directory: " + created + " at " + downloadsDir.getAbsolutePath());
        }
        
        String baseName = fileName.replaceAll("[^a-zA-Z0-9]", "_");
        File tsFile = new File(downloadsDir, baseName + ".ts");
        File mkvFile = new File(downloadsDir, baseName + ".mkv");
        
        Log.d(TAG, "Download path: " + mkvFile.getAbsolutePath());
        
        try {
            progressCallback.onProgress("Fetching playlist", 5, null, 0);
            String variantUrl = parsePlaylistAndGetVariant(m3u8Url, quality);
            
            progressCallback.onProgress("Analyzing segments", 10, null, 0);
            List<SegmentInfo> segmentInfos = parseSegmentPlaylistWithDuration(variantUrl);
            
            if (segmentInfos.isEmpty()) {
                throw new IOException("No segments found");
            }
            
            // Calculate total duration
            for (SegmentInfo info : segmentInfos) {
                totalDuration += info.duration;
            }
            Log.d(TAG, String.format("Total duration: %.1f seconds (%dm %ds)", 
                totalDuration, (int)(totalDuration / 60), (int)(totalDuration % 60)));
            Log.d(TAG, "Found " + segmentInfos.size() + " segments to download");
            
            List<byte[]> segments = new ArrayList<>();
            long totalBytes = 0;
            
            for (int i = 0; i < segmentInfos.size(); i++) {
                try {
                    int progress = 10 + (i * 70 / segmentInfos.size());
                    
                    byte[] segment = downloadSegment(segmentInfos.get(i).url);
                    segments.add(segment);
                    totalBytes += segment.length;
                    
                    // Calculate quality estimate periodically
                    if (i > 0 && totalDuration > 0) {
                        double downloadedDuration = (double)(i + 1) / segmentInfos.size() * totalDuration;
                        if (downloadedDuration > 0) {
                            calculateQualityEstimate(totalBytes, downloadedDuration);
                        }
                    }
                    
                    // Send progress with quality info
                    progressCallback.onProgress("Downloading", progress, estimatedQuality, bitrateMbps);
                    
                    // Log every 10 segments
                    if (i % 10 == 0) {
                        Log.d(TAG, String.format("Downloaded segment %d/%d - Total: %d MB - Est: %s @ %.1f Mbps", 
                            (i + 1), segmentInfos.size(), (totalBytes / 1024 / 1024), 
                            estimatedQuality, bitrateMbps));
                    }
                    
                    if (i < segmentInfos.size() - 1) {
                        Thread.sleep(100); // Rate limit protection
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Download interrupted");
                }
            }
            
            // Final quality calculation
            calculateQualityEstimate(totalBytes, totalDuration);
            Log.d(TAG, String.format("Final quality: %s @ %.2f Mbps", estimatedQuality, bitrateMbps));
            
            Log.d(TAG, "All segments downloaded. Total: " + (totalBytes / 1024 / 1024) + " MB");
            
            progressCallback.onProgress("Merging segments", 85, estimatedQuality, bitrateMbps);
            mergeSegments(segments, tsFile.getAbsolutePath());
            
            progressCallback.onProgress("Converting to MKV", 92, estimatedQuality, bitrateMbps);
            File finalFile = convertToMKV(tsFile, mkvFile.getAbsolutePath());
            
            // Notify media scanner so file shows up in Gallery/Files app
            notifyMediaScanner(finalFile);
            
            progressCallback.onProgress("Complete", 100, estimatedQuality, bitrateMbps);
            progressCallback.onFileReady(finalFile.getAbsolutePath(), estimatedQuality, bitrateMbps);
            
            Log.d(TAG, String.format("Download complete! File: %s Size: %d MB Quality: %s @ %.2f Mbps", 
                finalFile.getAbsolutePath(), (finalFile.length() / 1024 / 1024), 
                estimatedQuality, bitrateMbps));
            
            return finalFile.getAbsolutePath();
            
        } catch (Exception e) {
            Log.e(TAG, "Download error: " + e.getMessage(), e);
            progressCallback.onError(e.getMessage());
            throw e;
        } finally {
            releaseWakeLock();
        }
    }

    /**
     * Parse segment playlist and extract duration for each segment
     */
    private List<SegmentInfo> parseSegmentPlaylistWithDuration(String playlistUrl) throws IOException {
        String content = downloadContent(playlistUrl);
        List<SegmentInfo> segments = new ArrayList<>();
        
        String[] lines = content.split("\n");
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].contains("EXTINF")) {
                // Parse duration from #EXTINF:5.005,
                double duration = 0;
                try {
                    String durationStr = lines[i].replaceAll(".*EXTINF:([0-9.]+).*", "$1");
                    duration = Double.parseDouble(durationStr);
                } catch (Exception e) {
                    duration = 5.0; // Default segment duration
                }
                
                if (i + 1 < lines.length) {
                    String url = lines[i + 1].trim();
                    if (!url.isEmpty() && !url.startsWith("#")) {
                        String fullUrl = url.startsWith("http") ? url : resolveUrl(playlistUrl, url);
                        segments.add(new SegmentInfo(fullUrl, duration));
                    }
                }
            }
        }
        
        return segments;
    }

    /**
     * Helper class to hold segment URL and duration
     */
    private static class SegmentInfo {
        String url;
        double duration;
        
        SegmentInfo(String url, double duration) {
            this.url = url;
            this.duration = duration;
        }
    }

    /**
     * Notify the media scanner so the file shows up in Gallery/Files app
     */
    private void notifyMediaScanner(File file) {
        try {
            Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            intent.setData(android.net.Uri.fromFile(file));
            context.sendBroadcast(intent);
            Log.d(TAG, "Media scanner notified for: " + file.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "Failed to notify media scanner: " + e.getMessage());
        }
    }

    private String parsePlaylistAndGetVariant(String m3u8Url, String quality) throws IOException {
        String content = downloadContent(m3u8Url);
        
        String[] lines = content.split("\n");
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].contains("EXT-X-STREAM-INF")) {
                if (i + 1 < lines.length) {
                    String url = lines[i + 1].trim();
                    if (!url.isEmpty() && !url.startsWith("#")) {
                        return url.startsWith("http") ? url : resolveUrl(m3u8Url, url);
                    }
                }
            }
        }
        
        return m3u8Url;
    }

    private List<String> parseSegmentPlaylist(String playlistUrl) throws IOException {
        String content = downloadContent(playlistUrl);
        List<String> segments = new ArrayList<>();
        
        String[] lines = content.split("\n");
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].contains("EXTINF")) {
                if (i + 1 < lines.length) {
                    String url = lines[i + 1].trim();
                    if (!url.isEmpty() && !url.startsWith("#")) {
                        segments.add(url.startsWith("http") ? url : resolveUrl(playlistUrl, url));
                    }
                }
            }
        }
        
        return segments;
    }

    private String resolveUrl(String baseUrl, String relativeUrl) {
        try {
            URL base = new URL(baseUrl);
            URL resolved = new URL(base, relativeUrl);
            return resolved.toString();
        } catch (Exception e) {
            return relativeUrl;
        }
    }

    /**
     * Updated callback interface with quality info
     */
    public interface DownloadProgressCallback {
        void onProgress(String status, int progress, String estimatedQuality, double bitrateMbps);
        void onFileReady(String filePath, String estimatedQuality, double bitrateMbps);
        void onError(String error);
    }
}
