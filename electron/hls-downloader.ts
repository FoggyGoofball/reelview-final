/**
 * Stream Downloader Module
 * 
 * Downloads HLS streams using Electron's session for authentication
 * Converts to MKV using FFmpeg for broad compatibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { app, BrowserWindow, net, session } from 'electron';
import * as os from 'os';
import * as zlib from 'zlib';
import { getFFmpegPath, hasFFmpeg, convertToMKV, logFFmpeg } from './ffmpeg-manager';

export type StreamType = 'hls' | 'mp4' | 'dash' | 'unknown';

export interface CapturedStream {
  url: string;
  type: StreamType;
  timestamp: number;
  content?: string;
}

export interface QualityVariant {
  url: string;
  bandwidth: number;
  resolution?: string;
  label: string;
}

export interface HLSSegment {
  uri: string;
  duration: number;
  sequence: number;
}

export interface HLSPlaylist {
  type: 'master' | 'media';
  baseUrl: string;
  segments?: HLSSegment[];
  variants?: QualityVariant[];
}

export interface DownloadProgress {
  status: 'idle' | 'fetching' | 'parsing' | 'downloading' | 'merging' | 'converting' | 'complete' | 'error' | 'cancelled';
  progress: number;
  currentSegment?: number;
  totalSegments?: number;
  downloadedBytes?: number;
  error?: string;
  filePath?: string;
  estimatedQuality?: string;  // NEW: Quality estimated from bitrate
  bitrateMbps?: number;       // NEW: Average bitrate in Mbps
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  quality?: string;
  resolution?: string;        // NEW: Detected resolution like "1920x1080"
  detectedQuality?: string;   // NEW: Derived quality like "1080p"
  estimatedQuality?: string;  // NEW: Quality estimated from bitrate
  bitrateMbps?: number;       // NEW: Average bitrate
  status: DownloadProgress['status'];
  progress: number;
  downloadedBytes: number;
  filePath?: string;
  error?: string;
  startTime: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

// =====================================================
// FILE LOGGING
// =====================================================
const logFile = path.join(os.homedir(), 'reelview-downloader.log');

function logDL(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
  console.log('[DL]', msg);
}

// Start logging
try {
  fs.writeFileSync(logFile, `=== DOWNLOADER STARTED ${new Date().toISOString()} ===\n`);
} catch (e) {}

// Store for captured streams
let capturedStreams: Map<string, CapturedStream[]> = new Map();
let capturedMasterPlaylists: Map<string, string> = new Map(); // NEW: Store master playlist URLs separately
let currentDownload: AbortController | null = null;
let downloadsList: DownloadItem[] = [];

function detectStreamType(url: string): StreamType {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.m3u8')) return 'hls';
  if (lowerUrl.includes('.mpd')) return 'dash';
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('googlevideo')) return 'mp4';
  return 'unknown';
}

/**
 * Estimate video quality based on bitrate
 */
function estimateQualityFromBitrate(bitrateMbps: number): string {
  if (bitrateMbps >= 8) return '1080p';
  if (bitrateMbps >= 4) return '720p';
  if (bitrateMbps >= 2) return '480p';
  if (bitrateMbps >= 1) return '360p';
  return '240p';
}

/**
 * Estimate video quality based on file size and duration
 */
function estimateQualityFromSize(fileSizeBytes: number, durationSeconds: number): { quality: string; bitrateMbps: number } {
  const bitrateBps = (fileSizeBytes * 8) / durationSeconds;
  const bitrateMbps = bitrateBps / 1000000;
  const quality = estimateQualityFromBitrate(bitrateMbps);
  
  logDL(`Quality estimation: ${fileSizeBytes} bytes, ${durationSeconds}s = ${bitrateMbps.toFixed(2)} Mbps = ${quality}`);
  
  return { quality, bitrateMbps };
}

// =====================================================
// FFMPEG HANDLING - Now uses ffmpeg-manager
// =====================================================
// Conversion is handled by ffmpeg-manager.ts which uses bundled FFmpeg

// =====================================================
// NETWORK FETCHING
// =====================================================

function fetchWithSession(url: string, ses: Electron.Session): Promise<string> {
  return new Promise((resolve, reject) => {
    logDL(`fetchWithSession: ${url.substring(0, 100)}`);
    
    const request = net.request({
      url,
      session: ses,
      useSessionCookies: true,
    });
    
    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    request.setHeader('Accept', '*/*');
    request.setHeader('Accept-Encoding', 'gzip, deflate');
    
    const chunks: Buffer[] = [];
    
    request.on('response', (response) => {
      logDL(`Response status: ${response.statusCode}`);
      
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers['location'];
        if (location) {
          fetchWithSession(Array.isArray(location) ? location[0] : location, ses)
            .then(resolve)
            .catch(reject);
          return;
        }
      }
      
      response.on('data', (chunk) => chunks.push(chunk));
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const encoding = response.headers['content-encoding'];
        
        if (encoding === 'gzip' || (Array.isArray(encoding) && encoding.includes('gzip'))) {
          try {
            const decompressed = zlib.gunzipSync(buffer);
            resolve(decompressed.toString('utf-8'));
          } catch (e) {
            resolve(buffer.toString('utf-8'));
          }
        } else {
          resolve(buffer.toString('utf-8'));
        }
      });
      
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.end();
  });
}

function downloadWithSession(url: string, ses: Electron.Session): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      session: ses,
      useSessionCookies: true,
    });
    
    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    request.setHeader('Accept', '*/*');
    
    const chunks: Buffer[] = [];
    
    request.on('response', (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers['location'];
        if (location) {
          downloadWithSession(Array.isArray(location) ? location[0] : location, ses)
            .then(resolve)
            .catch(reject);
          return;
        }
      }
      
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.end();
  });
}

// =====================================================
// M3U8 PARSING
// =====================================================

function parseM3U8(content: string, baseUrl: string): HLSPlaylist {
  logDL(`parseM3U8: ${content.length} bytes from ${baseUrl.substring(0, 80)}`);
  
  if (content.includes('<!DOCTYPE') || content.includes('<html')) {
    throw new Error('Blocked by Cloudflare - got HTML instead of m3u8');
  }
  
  if (!content.includes('#EXTM3U')) {
    throw new Error('Invalid m3u8 format');
  }
  
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  // Log first 20 lines to understand format
  logDL(`First 20 lines of playlist:`);
  lines.slice(0, 20).forEach((line, i) => logDL(`  ${i}: ${line.substring(0, 100)}`));
  
  const hasStreamInf = lines.some(l => l.startsWith('#EXT-X-STREAM-INF'));
  const hasSegments = lines.some(l => l.startsWith('#EXTINF'));
  
  logDL(`Playlist analysis: hasStreamInf=${hasStreamInf}, hasSegments=${hasSegments}, lines=${lines.length}`);
  
  // If it has #EXT-X-STREAM-INF, it's definitely a master playlist with variants
  if (hasStreamInf) {
    logDL(`MASTER playlist detected (has #EXT-X-STREAM-INF)`);
    const variants: QualityVariant[] = [];
    const seenUrls = new Set<string>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bandwidthMatch = line.match(/BANDWIDTH[=:](\d+)/i);
        const resolutionMatch = line.match(/RESOLUTION[=:]([0-9]+x[0-9]+)/i);
        const fpsMatch = line.match(/FRAME-RATE[=:]([0-9.]+)/i);
        
        // Find the URL line
        let urlLine = '';
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const candidate = lines[j];
          if (!candidate.startsWith('#') && candidate.length > 0) {
            urlLine = candidate;
            break;
          }
        }
        
        if (urlLine && !urlLine.includes('.key')) {
          const variantUrl = urlLine.startsWith('http') ? urlLine : new URL(urlLine, baseUrl).href;
          
          if (!seenUrls.has(variantUrl)) {
            seenUrls.add(variantUrl);
            
            const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;
            const resolution = resolutionMatch ? resolutionMatch[1] : undefined;
            const fps = fpsMatch ? parseFloat(fpsMatch[1]) : undefined;
            
            let label = 'Stream';
            if (resolution) {
              const height = resolution.split('x')[1];
              label = `${height}p`;
            }
            if (fps) {
              label += `@${fps}fps`;
            }
            if (bandwidth > 0) {
              const mbps = (bandwidth / 1000000).toFixed(1);
              label += ` (${mbps}Mbps)`;
            }
            
            variants.push({ url: variantUrl, bandwidth, resolution, label });
            logDL(`Found variant: ${label}`);
          }
        }
      }
    }
    
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    logDL(`Total variants found: ${variants.length}`);
    return { type: 'master', baseUrl, variants };
  }
  
  // If it has EXTINF tags, treat it as a media playlist
  if (hasSegments) {
    logDL(`MEDIA playlist detected (has #EXTINF segments)`);
    const segments: HLSSegment[] = [];
    let sequence = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXTINF')) {
        const durationMatch = lines[i].match(/:([0-9.]+)/);
        const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;
        
        for (let j = i + 1; j < lines.length; j++) {
          if (!lines[j].startsWith('#')) {
            const urlLine = lines[j];
            if (urlLine && !urlLine.includes('.key')) {
              const segmentUrl = urlLine.startsWith('http') ? urlLine : new URL(urlLine, baseUrl).href;
              segments.push({ uri: segmentUrl, duration, sequence: sequence++ });
            }
            break;
          }
        }
      }
    }
    
    logDL(`Found ${segments.length} segments`);
    return { type: 'media', baseUrl, segments };
  }
  
  throw new Error('Unknown playlist format');
}

// =====================================================
// QUALITY VARIANTS
// =====================================================

/**
 * Get available quality variants for a stream
 * Always fetches fresh from the master playlist
 */
export async function getQualityVariants(
  m3u8Url: string,
  window: BrowserWindow
): Promise<QualityVariant[]> {
  const ses = window.webContents.session;
  
  logDL(`\n========== GET QUALITY VARIANTS ==========`);
  logDL(`Input URL: ${m3u8Url.substring(0, 120)}`);
  
  try {
    const content = await fetchWithSession(m3u8Url, ses);
    logDL(`? Fetched m3u8 content: ${content.length} bytes`);
    
    if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      logDL(`? Got HTML instead of m3u8 - content is blocked/invalid`);
      logDL(`Content: ${content.substring(0, 200)}`);
      throw new Error('Got HTML instead of m3u8 - Cloudflare or access issue');
    }
    
    const playlist = parseM3U8(content, m3u8Url);
    
    if (playlist.type === 'master' && playlist.variants?.length) {
      logDL(`? Master playlist - found ${playlist.variants.length} variants:`);
      playlist.variants.forEach((v, i) => {
        logDL(`  [${i}] ${v.label}`);
        logDL(`      URL: ${v.url.substring(0, 100)}`);
      });
      return playlist.variants;
    }
    
    logDL(`Single quality stream - will use as-is`);
    return [{
      url: m3u8Url,
      bandwidth: 0,
      resolution: undefined,
      label: 'Default Quality'
    }];
  } catch (error: any) {
    logDL(`? Error: ${error.message}`);
    logDL(`Falling back to original URL`);
    return [{
      url: m3u8Url,
      bandwidth: 0,
      resolution: undefined,
      label: 'Default Quality'
    }];
  }
}

// =====================================================
// DOWNLOAD FUNCTION
// =====================================================

async function downloadHLSStream(
  variantUrl: string,
  outputPath: string,
  onProgress: ProgressCallback,
  ses: Electron.Session
): Promise<{ filePath: string; estimatedQuality: string; bitrateMbps: number }> {
  onProgress({ status: 'parsing', progress: 5 });
  
  logDL('\n========== STARTING DOWNLOAD ==========');
  logDL('URL: ' + variantUrl.substring(0, 100));
  logDL('Output: ' + outputPath);
  
  const content = await fetchWithSession(variantUrl, ses);
  let playlist = parseM3U8(content, variantUrl);
  
  // Handle master playlist
  if (playlist.type === 'master' && playlist.variants?.length) {
    const bestVariant = playlist.variants[0];
    logDL(`Master playlist - using: ${bestVariant.label}`);
    const variantContent = await fetchWithSession(bestVariant.url, ses);
    playlist = parseM3U8(variantContent, bestVariant.url);
  }
  
  if (!playlist.segments?.length) {
    throw new Error('No segments found in playlist');
  }
  
  // Calculate total duration from segments
  let totalDuration = 0;
  for (const segment of playlist.segments) {
    totalDuration += segment.duration;
  }
  logDL(`Total video duration: ${totalDuration.toFixed(1)} seconds (${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s)`);
  
  const totalSegments = playlist.segments.length;
  logDL(`Downloading ${totalSegments} segments...`);
  
  onProgress({
    status: 'downloading',
    progress: 10,
    currentSegment: 0,
    totalSegments,
    downloadedBytes: 0
  });
  
  const tempDir = path.join(app.getPath('temp'), `reelview-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const segmentFiles: string[] = [];
  let downloadedBytes = 0;
  
  for (let i = 0; i < playlist.segments.length; i++) {
    if (currentDownload?.signal.aborted) {
      throw new Error('Download cancelled');
    }
    
    const segment = playlist.segments[i];
    const segmentPath = path.join(tempDir, `seg_${String(i).padStart(6, '0')}.ts`);
    
    try {
      const data = await downloadWithSession(segment.uri, ses);
      fs.writeFileSync(segmentPath, data);
      segmentFiles.push(segmentPath);
      downloadedBytes += data.length;
      
      const progress = 10 + Math.round((i + 1) / totalSegments * 70);
      
      // Estimate quality periodically during download
      let estimatedQuality: string | undefined;
      let bitrateMbps: number | undefined;
      if (i > 0 && totalDuration > 0) {
        const downloadedDuration = (i + 1) / totalSegments * totalDuration;
        if (downloadedDuration > 0) {
          const result = estimateQualityFromSize(downloadedBytes, downloadedDuration);
          estimatedQuality = result.quality;
          bitrateMbps = result.bitrateMbps;
        }
      }
      
      onProgress({
        status: 'downloading',
        progress,
        currentSegment: i + 1,
        totalSegments,
        downloadedBytes,
        estimatedQuality,
        bitrateMbps
      });
    } catch (err: any) {
      logDL(`Segment ${i} failed: ${err.message}`);
    }
  }
  
  if (segmentFiles.length === 0) {
    throw new Error('Failed to download any segments');
  }
  
  // Calculate final quality estimate
  const { quality: finalQuality, bitrateMbps: finalBitrate } = estimateQualityFromSize(downloadedBytes, totalDuration);
  logDL(`Final quality estimate: ${finalQuality} @ ${finalBitrate.toFixed(2)} Mbps`);
  
  // Merge segments to temp TS file
  onProgress({ status: 'merging', progress: 82, downloadedBytes, estimatedQuality: finalQuality, bitrateMbps: finalBitrate });
  logDL(`Merging ${segmentFiles.length} segments...`);
  
  const tempTsPath = path.join(tempDir, 'merged.ts');
  const outputStream = fs.createWriteStream(tempTsPath);
  
  await new Promise<void>((resolve, reject) => {
    let fileIndex = 0;
    
    const writeNext = () => {
      if (fileIndex >= segmentFiles.length) {
        outputStream.end();
        return;
      }
      
      const segmentPath = segmentFiles[fileIndex++];
      const data = fs.readFileSync(segmentPath);
      
      if (!outputStream.write(data)) {
        outputStream.once('drain', writeNext);
      } else {
        writeNext();
      }
    };
    
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
    writeNext();
  });
  
  // Cleanup segment files
  for (const file of segmentFiles) {
    try { fs.unlinkSync(file); } catch (e) {}
  }
  
  // ALWAYS convert to MKV (bundled FFmpeg)
  onProgress({ status: 'converting', progress: 90, downloadedBytes, estimatedQuality: finalQuality, bitrateMbps: finalBitrate });
  logDL('Converting to MKV using bundled FFmpeg...');
  
  // Ensure output path ends with .mkv
  const mkvPath = outputPath.replace(/\.[^.]+$/, '.mkv');
  
  const finalPath = await convertToMKV(tempTsPath, mkvPath, (status) => {
    logDL(`Conversion: ${status}`);
  });
  
  // Cleanup temp directory
  try { fs.rmdirSync(tempDir, { recursive: true }); } catch (e) {}
  
  const finalSize = fs.statSync(finalPath).size;
  logDL(`? COMPLETE: ${path.basename(finalPath)} (${(finalSize / 1024 / 1024).toFixed(2)} MB) - ${finalQuality}`);
  
  onProgress({
    status: 'complete',
    progress: 100,
    downloadedBytes: finalSize,
    filePath: finalPath,
    estimatedQuality: finalQuality,
    bitrateMbps: finalBitrate
  });
  
  return { filePath: finalPath, estimatedQuality: finalQuality, bitrateMbps: finalBitrate };
}

export async function downloadStream(
  variantUrl: string,
  outputPath: string,
  onProgress: ProgressCallback,
  window?: BrowserWindow
): Promise<{ filePath: string; estimatedQuality: string; bitrateMbps: number }> {
  currentDownload = new AbortController();
  
  try {
    const ses = window?.webContents.session || session.defaultSession;
    const result = await downloadHLSStream(variantUrl, outputPath, onProgress, ses);
    return result;
  } catch (error: any) {
    logDL(`ERROR: ${error.message}`);
    onProgress({
      status: 'error',
      progress: 0,
      error: error.message
    });
    throw error;
  } finally {
    currentDownload = null;
  }
}

export function cancelDownload(): void {
  if (currentDownload) {
    currentDownload.abort();
    currentDownload = null;
  }
}

// Downloads list management
export function getDownloadsList(): DownloadItem[] {
  return downloadsList;
}

export function addDownload(item: DownloadItem): void {
  downloadsList.unshift(item);
  if (downloadsList.length > 50) downloadsList.pop();
}

export function updateDownload(id: string, update: Partial<DownloadItem>): void {
  const idx = downloadsList.findIndex(d => d.id === id);
  if (idx >= 0) {
    downloadsList[idx] = { ...downloadsList[idx], ...update };
  }
}

export function removeDownload(id: string): void {
  downloadsList = downloadsList.filter(d => d.id !== id);
}

export function clearCompletedDownloads(): void {
  downloadsList = downloadsList.filter(d => 
    d.status !== 'complete' && d.status !== 'error' && d.status !== 'cancelled'
  );
}

// Stream capture
export function captureStream(url: string, content?: string, windowId: string = 'default'): void {
  const type = detectStreamType(url);
  if (type === 'unknown') return;
  
  // Don't capture embed page URLs
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/embed/') || 
      lowerUrl.includes('vidsrc.net') || 
      lowerUrl.includes('vidlink.pro') ||
      lowerUrl.includes('.html') ||
      lowerUrl.includes('.php')) {
    logDL(`Skipping non-m3u8 URL: ${url.substring(0, 60)}`);
    return;
  }
  
  logDL(`Captured: ${type} - ${url.substring(0, 80)}`);
  
  const stream: CapturedStream = { url, type, timestamp: Date.now(), content };
  
  if (!capturedStreams.has(windowId)) {
    capturedStreams.set(windowId, []);
  }
  
  const streams = capturedStreams.get(windowId)!;
  
  // Avoid duplicates
  if (!streams.some(s => s.url === url)) {
    streams.unshift(stream);
    if (streams.length > 10) streams.pop();
  }
}

// NEW: Store master playlist URL separately when detected
export function captureMasterPlaylist(url: string, windowId: string = 'default'): void {
  logDL(`Master playlist captured: ${url.substring(0, 80)}`);
  capturedMasterPlaylists.set(windowId, url);
}

export function getCapturedStreams(windowId: string = 'default'): CapturedStream[] {
  // Return master playlist first if available
  const masterUrl = capturedMasterPlaylists.get(windowId);
  const streams = capturedStreams.get(windowId) || [];
  
  // Filter out non-m3u8 URLs (like embed pages)
  const filteredStreams = streams.filter(s => {
    const url = s.url.toLowerCase();
    // Only return actual m3u8 streams, not embed pages
    return url.includes('.m3u8') || 
           url.includes('/pl/') ||  // Common playlist path
           url.includes('/hls/') ||
           (!url.includes('/embed/') && !url.includes('vidsrc.net') && !url.includes('vidlink.pro'));
  });
  
  if (masterUrl) {
    // Check if master URL is already in streams
    const hasMaster = filteredStreams.some(s => s.url === masterUrl);
    if (!hasMaster) {
      return [{ url: masterUrl, type: 'hls', timestamp: Date.now() }, ...filteredStreams];
    }
  }
  
  return filteredStreams;
}

export function clearCapturedStreams(windowId?: string): void {
  if (windowId) {
    capturedStreams.delete(windowId);
  } else {
    capturedStreams.clear();
  }
}

export function getAllCapturedStreams(): CapturedStream[] {
  const combined: CapturedStream[] = [];

  // include master playlists first
  for (const [winId, masterUrl] of capturedMasterPlaylists.entries()) {
    if (masterUrl) combined.push({ url: masterUrl, type: 'hls', timestamp: Date.now() });
    const arr = capturedStreams.get(winId) || [];
    for (const s of arr) combined.push(s);
  }

  // include any streams for windowIds that didn't have a master
  for (const [winId, arr] of capturedStreams.entries()) {
    if (!capturedMasterPlaylists.has(winId)) {
      for (const s of arr) combined.push(s);
    }
  }

  // dedupe by url preserving order
  const seen = new Set<string>();
  const deduped: CapturedStream[] = [];
  for (const s of combined) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      deduped.push(s);
    }
  }

  return deduped;
}

export function setupNetworkInterception(window: BrowserWindow): void {
  const ses = window.webContents.session;
  const windowId = String(window.id);
  
  logDL(`?? Setting up network interception for window ${windowId}`);
  
  // Track which URLs we've already fetched to check for master playlist
  const checkedUrls = new Set<string>();
  
  // Capture ONLY actual m3u8 files, not embed pages or other URLs
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const url = details.url.toLowerCase();
    
    const isActualM3U8 = 
      url.includes('.m3u8') ||
      url.includes('.m3u') ||
      url.includes('/playlist.m3u') ||
      url.includes('/master.m3u') ||
      url.includes('.mpd') ||
      (url.includes('/hls/') && !url.includes('.html')) ||
      (url.includes('/manifest') && !url.includes('.html'));
    
    const isExcluded = 
      url.includes('.css') || 
      url.includes('.js') || 
      url.includes('.html') ||
      url.includes('.htm') ||
      url.includes('.php') ||
      url.includes('.asp') ||
      url.includes('/embed/') ||
      url.includes('vidsrc.net/embed') ||
      url.includes('vidlink.pro/embed') ||
      url.includes('imdb.com') ||
      url.includes('tmdb.org') ||
      url.includes('google') ||
      url.includes('facebook') ||
      url.includes('twitter');
    
    if (isActualM3U8 && !isExcluded) {
      logDL(`? M3U8 URL captured: ${url.substring(0, 150)}`);
      captureStream(details.url, undefined, windowId);
      
      // Immediately send the updated captured streams list to renderer for debugging
      try {
        const all = getAllCapturedStreams();
        window.webContents.send('captured-streams-list', all);
        logDL(`Sent captured-streams-list to window ${windowId} (count=${all.length})`);
      } catch (e:any) {
        logDL(`Failed to send captured-streams-list: ${e?.message || e}`);
      }
      
      // Check if this might be a master playlist (async, don't block request)
      if (!checkedUrls.has(details.url)) {
        checkedUrls.add(details.url);
        
        // Fetch the playlist to see if it has variants
        fetchWithSession(details.url, ses).then(content => {
          if (content.includes('#EXT-X-STREAM-INF')) {
            logDL(`? Master playlist confirmed: ${details.url.substring(0, 80)}`);
            captureMasterPlaylist(details.url, windowId);
            try {
              const all2 = getAllCapturedStreams();
              window.webContents.send('captured-streams-list', all2);
              logDL(`Sent captured-streams-list after master detection to window ${windowId} (count=${all2.length})`);
            } catch (e:any) {
              logDL(`Failed to send captured-streams-list after master detection: ${e?.message || e}`);
            }
          }
        }).catch((err:any) => {
          logDL(`fetchWithSession error while checking master playlist: ${err?.message || err}`);
        });
      }
      
      window.webContents.send('stream-detected', {
        url: details.url,
        type: 'hls',
        timestamp: Date.now()
      });
    }
    
    callback({ cancel: false });
  });
  
  // Also intercept responses to catch m3u8 content type
  ses.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const contentType = details.responseHeaders?.['content-type'] || details.responseHeaders?.['Content-Type'];
    const ctValue = Array.isArray(contentType) ? contentType[0] : contentType;
    
    if (ctValue && (
      ctValue.includes('application/vnd.apple.mpegurl') ||
      ctValue.includes('application/x-mpegURL') ||
      ctValue.includes('audio/mpegurl')
    )) {
      const url = details.url.toLowerCase();
      if (!url.includes('/embed/') && !url.includes('.html')) {
        logDL(`? M3U8 by content-type: ${details.url.substring(0, 150)}`);
        captureStream(details.url, undefined, windowId);
        
        try {
          const all = getAllCapturedStreams();
          window.webContents.send('captured-streams-list', all);
          logDL(`Sent captured-streams-list to window ${windowId} (count=${all.length})`);
        } catch (e:any) {
          logDL(`Failed to send captured-streams-list onHeadersReceived: ${e?.message || e}`);
        }
        
        window.webContents.send('stream-detected', {
          url: details.url,
          type: 'hls',
          timestamp: Date.now()
        });
      }
    }
    
    callback({ responseHeaders: details.responseHeaders });
  });
  
  console.log(`? Network interception enabled for window ${windowId}`);
  logDL(`? Network interception enabled`);
}
