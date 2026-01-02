// SPA wrapper for the unified download API exposed by the Electron/Capacitor preload
// Provides safe fallbacks for web builds.

interface DownloadAPI {
  getCapturedStreams?: () => Promise<any[]>;
  startDownload?: (url: string, filename: string, quality?: string) => Promise<any>;
  getQualityVariants?: (url: string) => Promise<any[]>;
  cancelDownload?: () => Promise<any>;
  getDownloadsList?: () => Promise<any>;
  removeDownload?: (id: string, deleteFile?: boolean) => Promise<any>;
  clearCompletedDownloads?: () => Promise<any>;
  onStreamCaptured?: (cb: (stream: any) => void) => () => void;
  onCapturedStreamsList?: (cb: (streams: any[]) => void) => () => void;
  onDownloadProgress?: (cb: (progress: any) => void) => () => void;
  onDownloadsUpdated?: (cb: (downloads: any[]) => void) => () => void;
  requestCapturedStreamsPush?: () => Promise<any>;
  getBuildInfo?: () => Promise<any>;
  openFile?: (path: string) => Promise<any>;
}

const electronApi = typeof window !== 'undefined' ? (window as any).electronDownload : null;
const capacitorPresent = typeof window !== 'undefined' ? !!(window as any).Capacitor : false;

export function getDownloadAPI(): DownloadAPI {
  if (electronApi) return electronApi;
  if (capacitorPresent) {
    const capacitorApi = (window as any).Capacitor?.Plugins?.HLSDownloader as DownloadAPI | undefined;
    if (capacitorApi) return capacitorApi;
  }

  const fallback: DownloadAPI = {
    getCapturedStreams: async () => [],
    startDownload: async () => ({ success: false, error: 'Not available' }),
    getQualityVariants: async () => [],
    cancelDownload: async () => ({ success: false }),
    getDownloadsList: async () => [],
    removeDownload: async () => ({ success: false }),
    clearCompletedDownloads: async () => ({ success: false }),
    onStreamCaptured: () => () => {},
    onCapturedStreamsList: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloadsUpdated: () => () => {},
    requestCapturedStreamsPush: async () => ({ success: false }),
    getBuildInfo: async () => ({ buildTime: new Date().toISOString() }),
    openFile: async () => ({ success: false }),
  };
  
  return fallback;
}

export function isDownloadAvailable(): boolean {
  return !!electronApi || !!capacitorPresent;
}

export function getPlatform(): 'electron' | 'capacitor' | 'web' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  if ((window as any).electronDownload) return 'electron';
  if ((window as any).Capacitor) return 'capacitor';
  return 'web';
}

export async function getBuildInfo(): Promise<any> {
  try {
    const api = getDownloadAPI();
    if (api && typeof api.getBuildInfo === 'function') return await api.getBuildInfo();
    return { buildTime: new Date().toISOString() };
  } catch (e) {
    return { buildTime: new Date().toISOString() };
  }
}

export default getDownloadAPI();
