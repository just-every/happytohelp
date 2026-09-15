import { useEffect } from 'react';
import { mountEditor, type EditorConfig } from './editor-widget';
// Optional server configuration. An authenticated local request reveals no credentials.
export function EditorLauncher({ authorized }: { authorized: boolean }) {
  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    let cleanup = () => {};
    void fetch('/api/identity/editor-config', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Editor unavailable'); return response.json() as Promise<EditorConfig>; })
      .then(config => { if (!controller.signal.aborted) cleanup = mountEditor(config, true); })
      .catch(() => { /* Optional management availability does not block the edition. */ });
    return () => { controller.abort(); cleanup(); };
  }, [authorized]);
  return null;
}
