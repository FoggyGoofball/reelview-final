import chokidar from 'chokidar';
import type { MenuItemConstructorOptions } from 'electron';
import {
  BrowserWindow,
  Menu,
  MenuItem,
  Tray,
  nativeImage,
  ipcMain,
  app,
  session,
  shell,
} from 'electron';
import electronIsDev from 'electron-is-dev';
import { join } from 'path';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import windowStateKeeper from 'electron-window-state';
import { cwd } from 'process';

const PORT = 3000;
let server: http.Server | null = null;

// =====================================================
// FILE LOGGING
// =====================================================
const logFile = path.join(require('os').homedir(), 'reelview-setup.log');

function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (e) {}
}

// Simple HTTP server
function startStaticServer(appDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let url = req.url || '/';
      const [pathname] = url.split('?');
      
      if (pathname.endsWith('.txt')) {
        res.writeHead(404);
        res.end();
        return;
      }

      if (path.extname(pathname)) {
        let filePath = join(appDir, pathname);
        
        if (!filePath.startsWith(appDir)) {
          res.writeHead(403);
          res.end();
          return;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end();
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentTypes: { [key: string]: string } = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
          };
          
          res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
          res.end(data);
        });
        return;
      }

      fs.readFile(join(appDir, 'index.html'), (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }

        console.log(`[HTTP Server] Route requested: ${pathname}`);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`? Static server running on http://localhost:${PORT}`);
      resolve();
    }).on('error', reject);
  });
}

const reloadWatcher = {
  debouncer: null as any,
  ready: false,
  watcher: null as any,
};

export function setupReloadWatcher(electronApp: ElectronApp): void {
  reloadWatcher.watcher = chokidar
    .watch(join(app.getAppPath(), 'app'), {
      ignored: /[/\\]\./,
      persistent: true,
    })
    .on('ready', () => {
      reloadWatcher.ready = true;
    })
    .on('all', () => {
      if (reloadWatcher.ready) {
        clearTimeout(reloadWatcher.debouncer);
        reloadWatcher.debouncer = setTimeout(async () => {
          electronApp.getMainWindow().webContents.reload();
          reloadWatcher.ready = false;
          reloadWatcher.debouncer = null;
          reloadWatcher.watcher = null;
          setupReloadWatcher(electronApp);
        }, 1500);
      }
    });
}

// Simplified Electron App (no Capacitor)
export class ElectronApp {
  private MainWindow: BrowserWindow | null = null;
  private TrayIcon: Tray | null = null;
  private TrayMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    new MenuItem({ label: 'Quit App', role: 'quit' }),
  ];
  private AppMenuBarMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
    { role: 'viewMenu' },
  ];
  private mainWindowState: any;

  constructor(
    trayMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[],
    appMenuBarMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[]
  ) {
    if (trayMenuTemplate) {
      this.TrayMenuTemplate = trayMenuTemplate;
    }
    if (appMenuBarMenuTemplate) {
      this.AppMenuBarMenuTemplate = appMenuBarMenuTemplate;
    }
  }

  private async loadMainWindow(thisRef: any) {
    if (!thisRef.MainWindow) return;
    thisRef.MainWindow.loadURL(`http://localhost:${PORT}`);
  }

  getMainWindow(): BrowserWindow {
    return this.MainWindow!;
  }

  async init(): Promise<void> {
    // Determine SPA directory candidates and prefer explicit spa/dist when available
    const candidates: { label: string; dir: string }[] = [];
    try {
      const appPath = app.getAppPath();
      candidates.push({ label: 'app (default)', dir: join(appPath, 'app') });
      candidates.push({ label: 'app.getAppPath()/../spa/dist', dir: join(appPath, '..', 'spa', 'dist') });
      candidates.push({ label: 'app.getAppPath()/../../spa/dist', dir: join(appPath, '..', '..', 'spa', 'dist') });
      candidates.push({ label: 'process.cwd()/spa/dist', dir: join(cwd(), 'spa', 'dist') });
      candidates.push({ label: '__dirname/../../spa/dist', dir: join(__dirname, '..', '..', 'spa', 'dist') });
    } catch (e:any) {
      logToFile(`Error computing SPA candidates: ${e?.message || e}`);
    }

    // Log candidates and choose first that exists
    let appDir = join(app.getAppPath(), 'app');
    try {
      logToFile(`app.getAppPath(): ${app.getAppPath()}`);
      for (const c of candidates) {
        try {
          const exists = fs.existsSync(c.dir);
          logToFile(`SPA candidate: ${c.label} => ${c.dir} (exists=${exists})`);
          if (exists) {
            // Prefer an explicit spa/dist directory over the default 'app'
            appDir = c.dir;
            logToFile(`Using SPA dir: ${appDir} (${c.label})`);
            break;
          }
        } catch (err:any) {
          logToFile(`Error checking candidate ${c.dir}: ${err?.message || err}`);
        }
      }

      // Log index.html info if present
      const indexPath = join(appDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        const stat = fs.statSync(indexPath);
        logToFile(`index.html found at ${indexPath} (mtime=${stat.mtime.toISOString()})`);
      } else {
        logToFile(`index.html NOT found at ${indexPath}`);
      }
    } catch (e:any) {
      logToFile(`SPA detection error: ${e?.message || e}`);
    }

    try {
      await startStaticServer(appDir);
    } catch (error) {
      console.error('Failed to start static server:', error);
    }

    const icon = nativeImage.createFromPath(
      join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'appIcon.ico' : 'appIcon.png')
    );
    
    this.mainWindowState = windowStateKeeper({
      defaultWidth: 1000,
      defaultHeight: 800,
    });

    const preloadPath = join(app.getAppPath(), 'build', 'preload.js');
    logToFile(`Preload path: ${preloadPath}`);
    logToFile(`Preload exists: ${fs.existsSync(preloadPath)}`);
    console.log(`[SETUP] Preload path: ${preloadPath}`);
    console.log(`[SETUP] Preload exists: ${fs.existsSync(preloadPath)}`);

    const mainWindow = new BrowserWindow({
      icon,
      show: false,
      x: this.mainWindowState.x,
      y: this.mainWindowState.y,
      width: this.mainWindowState.width,
      height: this.mainWindowState.height,
      fullscreenable: true,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        webSecurity: false,
      },
    });

    this.MainWindow = mainWindow;
    this.mainWindowState.manage(this.MainWindow);

    this.MainWindow.webContents.on('did-start-loading', () => {
      logToFile('did-start-loading');
    });
    
    this.MainWindow.webContents.on('did-finish-load', () => {
      logToFile('did-finish-load');
      
      this.MainWindow!.webContents.executeJavaScript('typeof window.electronDownload')
        .then((result) => {
          logToFile(`window.electronDownload type: ${result}`);
          console.log(`[SETUP] window.electronDownload type: ${result}`);
        })
        .catch((err) => {
          logToFile(`executeJavaScript error: ${err.message}`);
        });
    });

    this.MainWindow.webContents.on('enter-html-full-screen', () => {
      this.MainWindow?.setFullScreen(true);
    });
    this.MainWindow.webContents.on('leave-html-full-screen', () => {
      this.MainWindow?.setFullScreen(false);
    });

    this.MainWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log(`[EVENT] Window open requested: ${url}`);
      if (url.includes('imdb.com')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    console.log('[SETUP] Window open handler installed - IMDB allowed, all else blocked');

    this.MainWindow.on('closed', () => {
      logToFile('Main window closed');
    });

    Menu.setApplicationMenu(Menu.buildFromTemplate(this.AppMenuBarMenuTemplate));

    this.loadMainWindow(this);

    this.MainWindow.webContents.on('dom-ready', () => {
      console.log('[MAIN] DOM Ready - window will now be shown');
      logToFile('dom-ready');
      this.MainWindow?.show();
      console.log('[MAIN] ? Window shown');
    });
  }
}

app.on('before-quit', () => {
  if (server) server.close();
});

export function setupContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders } });
  });
}
