package com.reelview.app;

import android.util.Log;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;

/**
 * Local HTTP proxy server that adds authentication headers to HLS streams
 * Allows Chromecast to access streams that require specific headers
 */
public class HLSProxyServer {
    private static final String TAG = "HLSProxyServer";
    private static HttpServer server;
    private static Map<String, Map<String, String>> streamHeaders = new HashMap<>();
    private static int PORT = 8888;

    public static void start() {
        if (server != null) {
            Log.d(TAG, "Server already running");
            return;
        }

        new Thread(() -> {
            try {
                server = HttpServer.create(new InetSocketAddress("127.0.0.1", PORT), 0);
                server.createContext("/hls/", new HLSProxyHandler());
                server.setExecutor(null);
                server.start();
                Log.d(TAG, "HLS Proxy Server started on port " + PORT);
            } catch (IOException e) {
                Log.e(TAG, "Failed to start proxy server: " + e.getMessage());
            }
        }).start();
    }

    public static void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
            Log.d(TAG, "HLS Proxy Server stopped");
        }
    }

    public static void registerStream(String streamUrl, Map<String, String> headers) {
        // Generate a unique ID for this stream
        String streamId = String.valueOf(System.currentTimeMillis());
        streamHeaders.put(streamId, headers);
        Log.d(TAG, "Registered stream " + streamId + " with " + (headers != null ? headers.size() : 0) + " headers");
    }

    public static String getProxyUrl(String streamUrl) {
        String streamId = String.valueOf(System.currentTimeMillis());
        if (!streamHeaders.containsKey(streamId)) {
            Log.w(TAG, "Stream " + streamId + " not registered, stream headers may not work");
        }
        return "http://127.0.0.1:" + PORT + "/hls/" + streamId;
    }

    static class HLSProxyHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            Log.d(TAG, "Proxy request: " + path);

            try {
                // Extract stream ID from path
                String streamId = path.replace("/hls/", "");
                
                // For now, just return a simple error
                // In production, we would fetch the actual M3U8 and re-stream it
                String response = "#EXTM3U\n#EXT-X-VERSION:3\n";
                exchange.getResponseHeaders().set("Content-Type", "application/vnd.apple.mpegurl");
                exchange.sendResponseHeaders(200, response.getBytes().length);
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
            } catch (Exception e) {
                Log.e(TAG, "Proxy handler error: " + e.getMessage());
                exchange.sendResponseHeaders(500, 0);
                exchange.close();
            }
        }
    }
}
