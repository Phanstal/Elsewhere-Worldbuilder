import { invokeCommand, isTauri } from '../../platform/tauri';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('This export did not produce any data.');
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (metadata.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

export function downloadInBrowser(
  filename: string,
  data: Blob | string,
  mimeType = 'application/octet-stream',
): void {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export interface SaveOptions {
  title: string;
  defaultPath: string;
  filters: { name: string; extensions: string[] }[];
}

export async function saveTextFile(
  text: string,
  filename: string,
  options: SaveOptions,
): Promise<boolean> {
  if (!isTauri()) {
    downloadInBrowser(filename, text, 'application/json');
    return true;
  }
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    title: options.title,
    defaultPath: options.defaultPath,
    filters: options.filters,
  });
  if (!path) return false;
  await invokeCommand('save_export', {
    path,
    dataBase64: bytesToBase64(new TextEncoder().encode(text)),
  });
  return true;
}

export async function saveBinaryFile(
  data: Uint8Array,
  filename: string,
  options: SaveOptions,
): Promise<boolean> {
  if (!isTauri()) {
    downloadInBrowser(
      filename,
      new Blob([data.buffer as ArrayBuffer], { type: 'image/png' }),
      'image/png',
    );
    return true;
  }
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    title: options.title,
    defaultPath: options.defaultPath,
    filters: options.filters,
  });
  if (!path) return false;
  await invokeCommand('save_export', { path, dataBase64: bytesToBase64(data) });
  return true;
}
