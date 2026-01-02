declare module 'src/lib/unified-download' {
  export function getDownloadAPI(): any;
  export function isDownloadAvailable(): boolean;
  export function getPlatform(): 'electron' | 'capacitor' | 'web' | 'unknown';
  const _default: any;
  export default _default;
}

declare module 'src/lib/unified-download.ts' {
  export * from 'src/lib/unified-download';
  const _default: any;
  export default _default;
}
