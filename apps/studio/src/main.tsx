import { createRoot } from 'react-dom/client';
import type { PreviewSurfaceVariantPreference } from '@core/preview/domain/PreviewSurfaceVariantPreference';


const appVersion = readEnvString('VITE_RELEASE_VERSION') ?? 'dev';
const previewProxyEnabled = readEnvBool('VITE_PREVIEW_PROXY_ENABLED', true);
const previewSurfacePreference = readPreviewSurfacePreference('VITE_PREVIEW_SURFACE');

function readEnvString(key: string): string | null {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvBool(key: string, fallback: boolean): boolean {
  const raw = readEnvString(key);
  if (raw === null) return fallback;
  return raw.toLowerCase() !== 'false';
}

function readPreviewSurfacePreference(key: string): PreviewSurfaceVariantPreference {
  const raw = readEnvString(key)?.toLowerCase();
  if (raw === 'canvas' || raw === 'native' || raw === 'auto') return raw;
  return 'auto';
}
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
const root = createRoot(rootElement);


const { createEditorApp } = await import('@bootstrap/editor/createEditorApp');
const app = await createEditorApp({ appVersion, previewProxyEnabled, previewSurfacePreference, projectPersistenceEnabled: true });
root.render(app);
