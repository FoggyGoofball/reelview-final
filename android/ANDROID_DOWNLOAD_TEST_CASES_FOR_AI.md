# Android Download Test Cases & Validation - AI Implementation Guide

## Overview
This document provides AI with specific test cases that validate each Android download feature against the proven Electron implementation.

---

## Test Suite 1: Stream Capture Validation

### Test 1.1: URL Pattern Capture (Method 1)
**Electron Equivalent:** `setupNetworkInterception()` - URL pattern detection

**Setup:**
- Navigate to any video page with known HLS source
- Video starts playing

**Expected Behavior:**
```
Logcat should show:
D/ReelViewWebViewClient: shouldInterceptRequest called for: https://...
D/ReelViewWebViewClient: ? HLS stream MATCHED (URL pattern): https://...m3u8
D/HLSDownloaderPlugin: Captured stream (native): https://...
```

**Validation:**
- [ ] Stream URL contains `.m3u8` pattern
- [ ] Log appears within 2 seconds of page load
- [ ] URL is stored in capturedStreams list

**AI Debugging if Failed:**
```
If no URL pattern logs:
1. Check if page has actual m3u8 URL
2. Verify isHLSStream() patterns match actual URLs
3. Check if shouldInterceptRequest() is even called
   - Look for "shouldInterceptRequest called" logs
   - If not present, WebViewClient not properly initialized
```

---

### Test 1.2: Fetch API Capture (Method 2)
**Electron Equivalent:** Native Electron doesn't have this (native API sufficient)

**Setup:**
- Open page that uses `fetch()` to load stream
- Example: Modern Vimeo, YouTube embeds

**Expected Behavior:**
```
Logcat should show:
[HLS-CAPTURE-JS] Stream capture interceptors installed
[HLS-CAPTURE-JS] Captured: https://...m3u8
D/HLSDownloaderPlugin: Captured stream (js): https://...
```

**Validation:**
- [ ] JavaScript injection happens on page load
- [ ] Fetch hook captures stream URL
- [ ] Stream is passed to Capacitor plugin

**AI Debugging if Failed:**
```
If no JS capture logs:
1. Check if [HLS-CAPTURE-JS] appears at all
   - If not, JavaScript injection failed
   - Check evaluateJavascript() error logs
   
2. Check if Capacitor.Plugins available
   - Add JS to verify: console.log(typeof window.Capacitor)
   - Should log "object"
   
3. Check if captureStream() method exists
   - Add error handling to JS injection
   - Log any call failures
```

---

### Test 1.3: XHR Capture (Method 3)
**Electron Equivalent:** Native Electron doesn't have this (native API sufficient)

**Setup:**
- Open page using older XMLHttpRequest for stream loading
- Example: Some embedded players

**Expected Behavior:**
```
Logcat should show:
[HLS-CAPTURE-JS] Captured: https://...m3u8
D/HLSDownloaderPlugin: Captured stream (js): https://...
```

**Validation:**
- [ ] XHR.open() hook captures request URL
- [ ] Stream pattern matches HLS detection
- [ ] Capacitor plugin receives call

---

### Test 1.4: DOM Mutation Capture (Method 4)
**Electron Equivalent:** Covered by network interception

**Setup:**
- Page dynamically injects `<source>` tag into video element
- Example: Custom players that set src dynamically

**Expected Behavior:**
```
Logcat should show:
[HLS-CAPTURE-JS] Captured: https://...m3u8
D/HLSDownloaderPlugin: Captured stream (js): https://...
```

**Validation:**
- [ ] MutationObserver detects source tag changes
- [ ] src attribute is extracted correctly
- [ ] Stream URL captured before playback

---

### Test 1.5: Race Condition Prevention
**Electron Equivalent:** Not applicable (native API always ready)

**Setup:**
- Watch page loads very quickly
- M3U8 URL detected before plugin fully initialized

**Expected Behavior:**
```
Logcat sequence:
D/ReelViewWebViewClient: ? HLS stream MATCHED: https://...
D/ReelViewWebViewClient: ? HLSDownloaderPlugin not yet available, queuing stream
D/HLSDownloaderPlugin: HLSDownloaderPlugin loaded
D/PendingStreamCapture: ? Processed pending stream: https://...
```

**Validation:**
- [ ] If stream detected before plugin ready, it's queued
- [ ] Plugin processes queued streams on load()
- [ ] Final result: Stream is captured despite timing

**AI Debugging if Failed:**
```
If race condition still occurs:
1. Check if PendingStreamCapture.queueStream() is called
   - Should see "Queued stream for later" log
   
2. Check if processPendingStreams() is called in load()
   - Should see "Processed pending stream" log
   
3. Check timing of when getCapturedStreams() is called
   - Must be AFTER plugin load completes
```

---

## Test Suite 2: Quality Variant Detection

### Test 2.1: Master Playlist Parsing
**Electron Equivalent:** `getQualityVariants()` function

**Setup:**
- Stream loaded and captured
- Click Download button
- Click "Choose Quality"

**Expected Behavior:**
```
Logcat should show:
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 1
D/HLSDownloaderPlugin: getQualityVariants parsing: https://...m3u8
D/HLSDownloaderPlugin: Found variant: 1080p (5.5Mbps)
D/HLSDownloaderPlugin: Found variant: 720p (2.8Mbps)
D/HLSDownloaderPlugin: Found variant: 480p (1.2Mbps)

App should show:
Quality dialog with options:
- 1080p (5.5Mbps)
- 720p (2.8Mbps)
- 480p (1.2Mbps)
```

**Validation:**
- [ ] M3U8 file fetched successfully
- [ ] EXT-X-STREAM-INF tags parsed
- [ ] Bandwidth values extracted correctly
- [ ] Resolution calculated from RESOLUTION tag or bandwidth
- [ ] Dialog displays quality options

**AI Debugging if Failed:**
```
If quality options don't appear:
1. Check if M3U8 file is actually reachable
   - Add logging to parseM3U8Variants()
   - Log the HTTP response status
   
2. Check if response is HTML instead of m3u8
   - Cloudflare/WAF might be blocking
   - Log first 200 chars of response
   
3. Check parsing regex patterns
   - EXT-X-STREAM-INF: pattern might not match
   - BANDWIDTH= pattern might not match
   - Add console.log for each regex match
```

---

### Test 2.2: Single Quality Stream
**Electron Equivalent:** Fallback in `getQualityVariants()`

**Setup:**
- Stream is direct m3u8 (not master playlist)
- No EXT-X-STREAM-INF tags

**Expected Behavior:**
```
Logcat should show:
D/HLSDownloaderPlugin: Single quality stream - will use as-is
D/HLSDownloaderPlugin: Found 0 variants, returning default

App should show:
Quality dialog with single option:
- Default Quality
```

**Validation:**
- [ ] Parser detects it's not a master playlist
- [ ] Returns original URL as default quality
- [ ] Dialog still works with single option

---

### Test 2.3: Pre-Cached Variants (Performance)
**Electron Equivalent:** Pre-caching during capture

**Setup:**
- Stream captured
- Immediately click Download before M3U8 might expire
- Choose Quality within 1-2 seconds

**Expected Behavior:**
```
Logcat should show:
D/HLSDownloaderPlugin: Captured stream (native): https://...
D/HLSDownloaderPlugin: Pre-cached 3 variants for URL
D/HLSDownloaderPlugin: Returning variants from cache
```

**Validation:**
- [ ] M3U8 pre-parsed in background thread
- [ ] Variants available immediately
- [ ] No parsing delay when clicking "Choose Quality"

---

## Test Suite 3: Download Functionality

### Test 3.1: Download Start
**Electron Equivalent:** `downloadStream()` function

**Setup:**
- Quality selected
- Click "Download" in quality dialog

**Expected Behavior:**
```
Logcat should show:
D/HLSDownloaderPlugin: Starting download: dl-1702438439000
D/HLSDownloaderPlugin: Foreground service started

App should show:
Progress dialog with:
- Status: "Finding Stream..."
- Progress bar at 0%
- Download ID displayed
```

**Validation:**
- [ ] Download ID created
- [ ] Foreground service started
- [ ] Progress dialog appears
- [ ] DownloadService running

---

### Test 3.2: Progress Reporting
**Electron Equivalent:** `onProgress()` callback with segment tracking

**Setup:**
- Download in progress
- Watch progress bar

**Expected Behavior:**
```
Logcat should show (every 1-2 seconds):
D/HLSDownloaderPlugin: Progress: analyzing - 10% - Quality:  @ 0.0 Mbps
D/HLSDownloaderPlugin: Progress: downloading - 25% - Quality: 720p @ 2.8 Mbps
D/HLSDownloaderPlugin: Progress: downloading - 50% - Quality: 720p @ 2.8 Mbps
D/HLSDownloaderPlugin: Progress: downloading - 75% - Quality: 720p @ 2.7 Mbps
D/HLSDownloaderPlugin: Progress: converting - 90% - Quality: 720p @ 2.8 Mbps

App should show:
Progress bar advancing smoothly from 0% to 100%
Quality and bitrate updating in real-time
```

**Validation:**
- [ ] Progress increments smoothly
- [ ] Bitrate calculation updates in real-time
- [ ] Quality detection refines as download progresses
- [ ] No UI freezing during progress updates

**AI Debugging if Failed:**
```
If progress not updating:
1. Check if notifyListeners() is being called
   - Should call every segment download
   
2. Check if JavaScript is receiving updates
   - Add console.log in download-button component
   
3. Check if estimateQualityFromSize() is working
   - Might be returning 0 bitrate
```

---

### Test 3.3: Download Completion
**Electron Equivalent:** File saved to output path

**Setup:**
- Download running
- Wait until progress reaches 100%

**Expected Behavior:**
```
Logcat should show:
D/HLSDownloaderPlugin: Download complete: dl-1702438439000 - Quality: 720p @ 2.8 Mbps

App should show:
Progress dialog closes
File appears in Downloads page with:
- Filename: [MovieTitle].mkv
- Quality badge: "720p"
- Size: 250 MB (or actual size)
- File path shown
```

**Validation:**
- [ ] File actually exists at file path
- [ ] File size is > 0 bytes
- [ ] Quality correctly identified from download
- [ ] Downloads page lists completed download

**AI Debugging if Failed:**
```
If file not created:
1. Check file permissions
   - getActivity().getExternalFilesDir() must be writable
   
2. Check FFmpeg/conversion
   - Logs should show "Converting to MKV"
   - FFmpeg must be available
   
3. Check thread completion
   - Download thread might still be running
   - UI might be showing UI before file write completes
```

---

## Test Suite 4: Electron Feature Parity

### Feature Comparison Matrix

```
Feature                          | Electron | Android | Test Case
---------------------------------|----------|---------|----------
URL pattern capture              | ?        | ?       | 1.1
Fetch API capture                | ? (native)| ?      | 1.2
XHR capture                       | ? (native)| ?      | 1.3
DOM mutation capture              | ? (native)| ?      | 1.4
Master playlist parsing           | ?        | ?       | 2.1
Quality detection                 | ?        | ?       | 2.2
Real-time bitrate calculation     | ?        | ?       | 3.2
Progress reporting                | ?        | ?       | 3.2
Download to file                  | ?        | ?       | 3.3
FFmpeg conversion                 | ?        | ??      | 3.3
Pre-caching variants              | ?        | ?       | 2.3
Race condition prevention         | N/A      | ?       | 1.5
```

### Test 4.1: Complete Download Workflow
**Electron Equivalent:** Full `downloadStream()` pipeline

**Setup:**
1. Navigate to video
2. Click Download
3. Select quality
4. Wait for completion
5. Check Downloads page

**Expected Results:**
```
All previous tests should PASS:
? Stream captured (1.1, 1.2, 1.3, 1.4)
? Quality variants shown (2.1, 2.2)
? Download starts and progresses (3.1, 3.2)
? File saved and listed (3.3)
```

**Success Criteria:**
- [ ] Complete workflow with no errors
- [ ] File is playable
- [ ] Quality detected accurately
- [ ] All logs are expected messages

---

## Troubleshooting Decision Tree for AI

```
"No streams found" on Download click?
?? Check stream capture logs (Test 1.1-1.4)
?  ?? Have capture logs at all?
?  ?  ?? NO ? WebViewClient not initialized
?  ?  ?      Fix: Check MainActivity.configureWebView()
?  ?  ?? YES ? Stream detected but not reaching plugin
?  ?           Check: Does plugin.getInstance() return null?
?  ?           Fix: Check PendingStreamCapture queue
?  ?? Streams captured but getCapturedStreams() returns empty?
?     Check: Are streams actually being stored?
?     Add logging to HLSDownloaderPlugin.storeCapturedStream()

"No quality options" after clicking "Choose Quality"?
?? Check if getCapturedStreams returns data
?  ?? Check parseM3U8Variants logs (Test 2.1)
?     ?? No variants found ? M3U8 parsing failed
?     ?  Check: HTTP response status
?     ?  Check: Is response HTML (Cloudflare block)?
?     ?  Fix: Add error logging to parsing
?     ?? Variants found ? UI issue
?        Check: Is quality dialog component receiving data?
?        Add: console.log in download-button component

Download doesn't progress?
?? Check if download thread started
?  ?? Is "Download thread started" log present?
?     ?? NO ? startDownload() not called
?     ?      Check: Is Capacitor plugin accessible?
?     ?? YES ? Check if HLSDownloader class available
?        Check: HLSDownloader.downloadStream() method exists

File not created?
?? Check file path permissions
?  ?? Is getExternalFilesDir() writable?
?     Try: Create dummy file first
?? Check FFmpeg availability
?  ?? Is conversion happening?
?     Check: "Converting to MKV" log appears
?? Check if thread completed
   Check: onFileReady() callback was called
```

---

## Performance Validation

### Test 5.1: Stream Capture Speed
**Metric:** Time from page load to stream capture

**Electron Baseline:** < 500ms  
**Android Target:** < 1000ms

**Measurement:**
```
Logcat logs have timestamps. Calculate:
  - "onPageFinished" timestamp
  - "Captured stream" timestamp
  - Difference = capture latency
```

**Validation:**
- [ ] Stream captured within 1 second
- [ ] No UI blocking
- [ ] Multiple streams captured if present

### Test 5.2: Quality Dialog Appearance
**Metric:** Time from "Choose Quality" click to dialog appearance

**Electron Baseline:** < 500ms  
**Android Target:** < 1500ms

**Measurement:**
```
- Record timestamp when "Choose Quality" clicked
- Record timestamp when dialog appears
- Calculate latency
```

**Validation:**
- [ ] Dialog appears within 1.5 seconds
- [ ] Quality variants all loaded
- [ ] No timeout errors

### Test 5.3: Download Speed
**Metric:** MB/s actual download rate

**Electron Baseline:** 2-5 MB/s (depends on network)  
**Android Target:** Similar to Electron

**Measurement:**
```
From logcat:
D/HLSDownloaderPlugin: Progress: downloading - X% - ... (timestamp)

Calculate:
  - Time elapsed: progressB_time - progressA_time
  - Bytes downloaded: (progressB% - progressA%) * totalBytes / 100
  - Speed: Bytes / Time
```

**Validation:**
- [ ] Speed is network-limited, not app-limited
- [ ] If slower than Electron, investigate bottleneck

---

## AI Implementation Checklist

### Pre-Testing
- [ ] Fresh rebuild with `./gradlew clean assembleDebug`
- [ ] Fresh install with `adb uninstall && adb install`
- [ ] Logcat filtering configured for test output
- [ ] Test videos identified (various sources)

### During Testing
- [ ] Run Test Suite 1 (Stream Capture) ? All 5 tests pass
- [ ] Run Test Suite 2 (Quality) ? All 3 tests pass
- [ ] Run Test Suite 3 (Download) ? All 3 tests pass
- [ ] Run Test Suite 4 (Parity) ? Complete workflow passes

### After Testing
- [ ] Document any failed tests with logcat output
- [ ] Measure performance metrics (Test 5)
- [ ] Validate against Electron baseline
- [ ] Create issue report if any test fails

---

## Success Criteria Summary

**Android download feature is complete when:**
1. ? Streams are captured on every page load (Test 1.1-1.4)
2. ? Quality options appear when requested (Test 2.1-2.3)
3. ? Download progresses smoothly (Test 3.1-3.2)
4. ? File is saved and playable (Test 3.3)
5. ? Performance is acceptable (Test 5)
6. ? Feature parity with Electron (Test 4.1)

**All tests PASS = Android download feature ready for production**

