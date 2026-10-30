// Talks to the app around this screen: the Android app (WebView) or the Windows app (WebView2).
// In a plain browser there is no native side and these calls are unavailable.

export type Platform = 'android' | 'windows' | 'web';

/** Injected by the Android app only into Money Hub's own page (WebViewCompat.addWebMessageListener). */
interface AndroidBridge { postMessage(json: string): void; onmessage: ((e: { data: string }) => void) | null }
interface WebView2 {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', fn: (e: { data: unknown }) => void): void;
}

declare global {
  interface Window {
    MoneyHubAndroid?: AndroidBridge;
    chrome?: { webview?: WebView2 };
  }
}

export const platform: Platform =
  typeof window !== 'undefined' && window.MoneyHubAndroid ? 'android'
    : typeof window !== 'undefined' && window.chrome?.webview ? 'windows'
      : 'web';

export const hasNative = platform !== 'web';

type Reply = { id?: number; ok?: boolean; result?: unknown; error?: string; event?: string; data?: unknown };

let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const listeners = new Map<string, Set<(data: unknown) => void>>();

function receive(msg: Reply) {
  if (msg.id != null && pending.has(msg.id)) {
    const p = pending.get(msg.id)!;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error || 'The app could not do that.'));
  } else if (msg.event) {
    listeners.get(msg.event)?.forEach((fn) => fn(msg.data));
  }
}

if (platform === 'android') {
  window.MoneyHubAndroid!.onmessage = (e) => receive(JSON.parse(e.data) as Reply);
  // The first message gives the app a way to send events (resume, back) to this page.
  window.MoneyHubAndroid!.postMessage(JSON.stringify({ id: 0, method: 'hello', params: {} }));
}
if (platform === 'windows') {
  window.chrome!.webview!.addEventListener('message', (e) => receive((typeof e.data === 'string' ? JSON.parse(e.data) : e.data) as Reply));
}

export function call<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 120_000): Promise<T> {
  if (!hasNative) return Promise.reject(new Error('This only works in the Money Hub app on your phone or laptop.'));
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The app took too long to answer.'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v as T); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    const msg = { id, method, params };
    if (platform === 'android') window.MoneyHubAndroid!.postMessage(JSON.stringify(msg));
    else window.chrome!.webview!.postMessage(msg);
  });
}

export function on(event: 'resume' | 'pause' | 'back' | 'captured', fn: (data: unknown) => void): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => listeners.get(event)!.delete(fn);
}

// ---- Typed helpers ---------------------------------------------------------------------------

export interface BioStatus { available: boolean; enrolled: boolean; label: string }
export interface SeenApp { pkg: string; label: string; count: number; lastAt: number }
export interface CaptureStatus {
  access: boolean;
  allowlist: string[];
  seen: SeenApp[];
  queued: number;
  configured: boolean;
}
export interface QueuedCapture { id: string; postedAt: number; box: { v: 1; epk: string; iv: string; ct: string } }
export interface HttpResult { status: number; body: string }

export const native = {
  bioStatus: () => (hasNative ? call<BioStatus>('bio.status') : Promise.resolve({ available: false, enrolled: false, label: '' })),
  bioEnroll: (secret: string) => call<void>('bio.enroll', { secret }),
  bioUnlock: () => call<{ secret: string }>('bio.unlock', {}, 300_000),
  bioClear: () => call<void>('bio.clear'),
  captureStatus: () => call<CaptureStatus>('capture.status'),
  captureOpenAccess: () => call<void>('capture.openAccess'),
  captureOpenBattery: () => call<void>('capture.openBattery'),
  captureSetAllowlist: (packages: string[]) => call<void>('capture.setAllowlist', { packages }),
  captureConfigure: (cfg: { publicKey: string; supabaseUrl?: string; anonKey?: string; dropToken?: string }) =>
    call<void>('capture.configure', cfg),
  captureRead: () => call<{ items: QueuedCapture[] }>('capture.read'),
  captureAck: (ids: string[]) => call<void>('capture.ack', { ids }),
  http: (req: { method: string; url: string; headers?: Record<string, string>; body?: string }) => call<HttpResult>('http', req, 60_000),
  saveFile: (name: string, mime: string, data: string, encoding: 'text' | 'base64' = 'text') =>
    call<{ saved: boolean }>('file.save', { name, mime, data, encoding }, 300_000),
  openUrl: (url: string) => (hasNative ? call<void>('open', { url }) : Promise.resolve(void window.open(url, '_blank', 'noopener'))),
};
