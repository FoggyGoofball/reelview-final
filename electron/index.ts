import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, ipcMain, dialog, BrowserWindow, shell } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { ElectronApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';
import { 
  downloadStream, 
  cancelDownload, 
  getCapturedStreams,
  getAllCapturedStreams,
  clearCapturedStreams,
  setupNetworkInterception,
  getQualityVariants,
  getDownloadsList,
  addDownload,
  updateDownload,
  removeDownload,
  clearCompletedDownloads,
  type DownloadItem
} from './hls-downloader';

unhandled();

// =====================================================
// FILE LOGGING
// =====================================================
const logFile = path.join(require('os').homedir(), 'reelview-main.log');

function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (e) {}
  console.log(message);
}

try {
  fs.writeFileSync(logFile, `=== MAIN PROCESS STARTED ${new Date().toISOString()} ===\n`);
} catch (e) {}

logToFile('Main process starting...');

console.log('='.repeat(80));
console.log('MAIN PROCESS STARTING');
console.log('='.repeat(80));

// --- IPC LOGGING ---
ipcMain.on('console-log', (event, { level, message }) => {
  logToFile(`[RENDERER-${level}] ${message}`);
});

console.log('[MAIN] IPC Logging listener ENABLED');

// --- DOWNLOAD IPC HANDLERS ---

ipcMain.handle('get-captured-streams', async (event) => {
  const windowId = String(BrowserWindow.fromWebContents(event.sender)?.id || 'default');
  try {
    logToFile(`IPC: get-captured-streams requested by window ${windowId}`);
    const streams = getCapturedStreams(windowId);
    logToFile(`IPC: per-window streams count for ${windowId} = ${streams?.length || 0}`);
    if (streams && streams.length > 0) {
      logToFile(`IPC: returning ${streams.length} streams for window ${windowId}`);
      return streams;
    }
    const all = getAllCapturedStreams();
    logToFile(`IPC: per-window empty - returning all captured streams count=${all.length}`);
    return all;
  } catch (e:any) {
    logToFile(`IPC get-captured-streams error: ${e?.message || e}`);
    return [];
  }
});

ipcMain.handle('get-quality-variants', async (event, { url }) => {
  logToFile(`IPC: get-quality-variants - ${url.substring(0, 80)}`);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return [];
  
  try {
    const variants = await getQualityVariants(url, window);
    logToFile(`Found ${variants.length} quality variants`);
    return variants;
  } catch (error: any) {
    logToFile(`Error getting variants: ${error.message}`);
    return [];
  }
});

ipcMain.handle('start-download', async (event, { url, filename, quality }) => {
  logToFile(`IPC: start-download - ${filename} @ ${quality || 'default'}`);
  logToFile(`Download URL: ${url.substring(0, 150)}`);
  const window = BrowserWindow.fromWebContents(event.sender);

  // Attempt to improve the filename when it's a generic placeholder like "video_<timestamp>"
  let baseName = String(filename || '').trim();
  try {
    const looksGeneric = /^video_\d+$/.test(baseName) || baseName.length < 4;
    if (looksGeneric && window) {
      try {
        // Ask the renderer for a human-friendly title (h1 or document.title)
        const remoteTitle: any = await window.webContents.executeJavaScript(`(function(){
          try {
            const h = document.querySelector('h1')?.innerText?.trim();
            return h || document.title || '';
          } catch(e) { return document.title || ''; }
        })()` , true);

        if (remoteTitle && typeof remoteTitle === 'string' && remoteTitle.trim().length > 0) {
          // sanitize remoteTitle to a safe filename
          const sanitized = remoteTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
          if (sanitized.length > 0) baseName = sanitized;
        }
      } catch (e:any) {
        logToFile(`Could not obtain title from renderer: ${e?.message || e}`);
      }
    }
  } catch (e:any) {
    logToFile(`Filename derivation error: ${e?.message || e}`);
  }

  // Always save as MKV (bundled FFmpeg handles conversion)
  const finalFilename = `${baseName.replace(/\.[^/.]+$/, '')}.mkv`;

  const { filePath } = await dialog.showSaveDialog(window!, {
    title: 'Save Video as MKV',
    defaultPath: path.join(app.getPath('downloads'), finalFilename),
    filters: [
      { name: 'Matroska Video (MKV)', extensions: ['mkv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!filePath) {
    return { success: false, error: 'Cancelled' };
  }

  // Create download item
  const downloadId = `dl-${Date.now()}`;
  const downloadItem: DownloadItem = {
    id: downloadId,
    filename: path.basename(filePath),
    url,
    quality,
    status: 'fetching',
    progress: 0,
    downloadedBytes: 0,
    startTime: Date.now()
  };

  addDownload(downloadItem);
  event.sender.send('downloads-updated', getDownloadsList());

  try {
    const result = await downloadStream(url, filePath, (progress) => {
      // Update with estimated quality from bitrate analysis
      updateDownload(downloadId, {
        status: progress.status,
        progress: progress.progress,
        downloadedBytes: progress.downloadedBytes || 0,
        filePath: progress.filePath,
        error: progress.error,
        estimatedQuality: progress.estimatedQuality,
        bitrateMbps: progress.bitrateMbps
      });

      event.sender.send('download-progress', { id: downloadId, ...progress });
      event.sender.send('downloads-updated', getDownloadsList());
    }, window!);

    // Update with final quality info
    updateDownload(downloadId, { 
      filename: path.basename(result.filePath),
      estimatedQuality: result.estimatedQuality,
      bitrateMbps: result.bitrateMbps
    });
    event.sender.send('downloads-updated', getDownloadsList());

    logToFile(`Download complete: ${result.filePath} - Quality: ${result.estimatedQuality} @ ${result.bitrateMbps.toFixed(2)} Mbps`);
    return { success: true, filePath: result.filePath, downloadId, quality: result.estimatedQuality };
  } catch (error: any) {
    logToFile(`Download error: ${error.message}`);
    updateDownload(downloadId, { status: 'error', error: error.message });
    event.sender.send('downloads-updated', getDownloadsList());
    return { success: false, error: error.message, downloadId };
  }
});

ipcMain.handle('cancel-download', async () => {
  cancelDownload();
  return { success: true };
});

ipcMain.handle('get-downloads-list', async () => {
  return getDownloadsList();
});

ipcMain.handle('remove-download', async (event, { id }) => {
  removeDownload(id);
  event.sender.send('downloads-updated', getDownloadsList());
  return { success: true };
});

ipcMain.handle('clear-completed-downloads', async (event) => {
  clearCompletedDownloads();
  event.sender.send('downloads-updated', getDownloadsList());
  return { success: true };
});

ipcMain.handle('clear-captured-urls', async (event) => {
  const windowId = String(BrowserWindow.fromWebContents(event.sender)?.id || 'default');
  clearCapturedStreams(windowId);
  return { success: true };
});

ipcMain.handle('open-file', async (event, filePath: string) => {
  try {
    if (!filePath) return { success: false, error: 'No path' };
    // Reveal the file in folder. If that fails, try to open it directly.
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (e) {
      try {
        await shell.openPath(filePath);
        return { success: true };
      } catch (err:any) {
        logToFile(`open-file failed: ${err.message}`);
        return { success: false, error: err.message };
      }
    }
  } catch (error:any) {
    logToFile(`open-file handler error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

logToFile('Download IPC handlers registered');
console.log('[MAIN] Download IPC handlers registered');

// Menu setup
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
  {
    label: 'Developer',
    submenu: [{
      label: 'Toggle DevTools',
      accelerator: 'Ctrl+Shift+I',
      click: (item, focusedWindow) => focusedWindow?.webContents.toggleDevTools(),
    }],
  },
];

console.log('[MAIN] Menu templates created');

const myApp = new ElectronApp(trayMenuTemplate, appMenuBarMenuTemplate);
console.log('[MAIN] ElectronApp initialized');

if (electronIsDev) {
  setupReloadWatcher(myApp);
  console.log('[MAIN] Reload watcher set up');
}

// Compute build info (git short hash) for debugging
let BUILD_INFO: { buildHash?: string; branch?: string; buildTime: string } = { buildTime: new Date().toISOString() };
try {
  const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  BUILD_INFO = { buildHash: hash, branch, buildTime: new Date().toISOString() };
  console.log(`BUILD_INFO: ${JSON.stringify(BUILD_INFO)}`);
  logToFile(`BUILD_INFO: ${JSON.stringify(BUILD_INFO)}`);
} catch (e:any) {
  logToFile(`BUILD_INFO error: ${e?.message || e}`);
}

ipcMain.handle('get-build-info', async () => {
  return BUILD_INFO;
});

// Run Application
(async () => {
  await app.whenReady();
  setupContentSecurityPolicy();
  
  const preloadPath = path.join(app.getAppPath(), 'build', 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  logToFile(`Preload path: ${preloadPath}`);
  logToFile(`Preload exists: ${preloadExists}`);
  
  await myApp.init();
  
  const mainWindow = myApp.getMainWindow();
  if (mainWindow) {
    setupNetworkInterception(mainWindow);
    logToFile('Network interception enabled');
    console.log('[MAIN] Stream capture enabled');
  }
  
  logToFile('Application initialized');
  console.log('[MAIN] Application initialized and content loaded');
})();

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async function () {
  if (myApp.getMainWindow().isDestroyed()) {
    await myApp.init();
  }
});

ipcMain.on('m3u8-content', (event, { url, size }) => {
  logToFile(`IPC: m3u8-content - ${url.substring(0, 80)}, size: ${size}`);
  
  try {
    event.sender.send('stream-captured', {
      url,
      type: 'hls',
      timestamp: Date.now(),
      ready: true
    });
  } catch (e) {
    logToFile(`Failed to forward stream-captured: ${e}`);
  }
});

ipcMain.on('m3u8-captured', (event, { url, size }) => {
  logToFile(`IPC: m3u8-captured - ${url.substring(0, 80)}, size: ${size}`);
});

ipcMain.handle('request-captured-streams-push', async (event) => {
  try {
    const windowId = String(BrowserWindow.fromWebContents(event.sender)?.id || 'default');
    const all = getAllCapturedStreams();
    // send only to the requesting renderer
    event.sender.send('captured-streams-list', all);
    logToFile(`request-captured-streams-push handled for window ${windowId}, sent ${all.length}`);
    return { success: true, count: all.length };
  } catch (e: any) {
    logToFile(`request-captured-streams-push failed: ${e?.message || e}`);
    return { success: false };
  }
});
