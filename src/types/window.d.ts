declare global {
  interface Window {
    electronDownload?: {
      getCapturedStreams?: () => Promise<any[]>;
      getAllCapturedStreams?: () => Promise<any[]>;
      startDownload?: (url: string, filename: string, quality?: string) => Promise<any>;
      getQualityVariants?: (url: string) => Promise<any[]>;
      cancelDownload?: (id?: string) => Promise<any>;
      getDownloadsList?: () => Promise<any[]>;
      removeDownload?: (id: string, deleteFile?: boolean) => Promise<any>;
      clearCompletedDownloads?: () => Promise<any>;
      clearCapturedUrls?: () => Promise<any>;
      requestCapturedStreamsPush?: () => Promise<any>;
      openFile?: (path: string) => Promise<any>;
      getBuildInfo?: () => Promise<any>;
      onStreamCaptured?: (cb: (stream: any) => void) => () => void;
      onCapturedStreamsList?: (cb: (streams: any[]) => void) => () => void;
      onDownloadProgress?: (cb: (progress: any) => void) => () => void;
      onDownloadsUpdated?: (cb: (downloads: any[]) => void) => () => void;
      [key: string]: any;
    };
    Capacitor?: any;
    [key: string]: any;
  }

  interface GlobalThis {
    electronDownload?: Window['electronDownload'];
  }
}

export {};
