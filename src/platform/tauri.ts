export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function markPlatform(): void {
  if (typeof document === 'undefined') return;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  document.documentElement.dataset.platform = isMac ? 'macos' : 'other';
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function listenForMenuCommands(
  handler: (command: string) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import('@tauri-apps/api/event');
  return listen<string>('elsewhere://command', (event) => handler(event.payload));
}
