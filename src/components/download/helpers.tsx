import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

export function formatFileSize(bytes: number | undefined) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function formatDuration(ms: number) {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export const statusLabels: Record<string, string> = {
  idle: 'Idle',
  fetching: 'Fetching',
  parsing: 'Parsing',
  downloading: 'Downloading',
  merging: 'Merging',
  converting: 'Converting',
  complete: 'Complete',
  error: 'Error',
  cancelled: 'Cancelled'
};

export function StatusIcon({ status }: { status: string }) {
  if (status === 'complete') return <CheckCircle className="h-6 w-6 text-green-400" />;
  if (status === 'error') return <XCircle className="h-6 w-6 text-red-400" />;
  return <Badge variant="secondary">{statusLabels[status] || status}</Badge>;
}

export function QualityBadge({ download }: { download: any }) {
  const q = download?.estimatedQuality || download?.detectedQuality || download?.quality || '';
  if (!q) return null;
  return <Badge variant="outline">{String(q)}</Badge>;
}

const _default = { formatFileSize, formatDuration, statusLabels, StatusIcon, QualityBadge };
export default _default;
