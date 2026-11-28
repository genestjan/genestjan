// Barcode scanning with three modes: native ML Kit (Capacitor), browser BarcodeDetector, or manual entry.
import { Capacitor } from '@capacitor/core';

export type ScanMode = 'native' | 'web' | 'manual';

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts?: { formats?: string[] }) => DetectorLike;

const detectorCtor = (): DetectorCtor | undefined => (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

export function scanMode(): ScanMode {
  if (Capacitor.isNativePlatform()) return 'native';
  if (detectorCtor() !== undefined && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia) return 'web';
  return 'manual';
}

/** Native full-screen scanner. Returns the code, or null if cancelled. Throws a readable error if not allowed. */
export async function scanNative(): Promise<string | null> {
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
  let perm = await BarcodeScanner.checkPermissions();
  if (perm.camera !== 'granted') perm = await BarcodeScanner.requestPermissions();
  if (perm.camera !== 'granted' && perm.camera !== 'limited') throw new Error('Camera access is off. Allow the camera in Settings, or type the code instead.');
  const { barcodes } = await BarcodeScanner.scan();
  return barcodes[0]?.rawValue ?? null;
}

/**
 * Start the browser camera in a <video> and call onCode when a barcode is seen.
 * Returns a stop function that releases the camera.
 */
export async function startWebScan(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const Ctor = detectorCtor();
  if (!Ctor) throw new Error('This browser cannot scan. Type the code instead.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    throw new Error('Camera access is off. Allow the camera, or type the code instead.');
  }
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  const detector = new Ctor();
  let stopped = false;
  let timer = 0;
  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const found = await detector.detect(video);
        if (found[0]?.rawValue && !stopped) {
          onCode(found[0].rawValue);
          return;
        }
      }
    } catch {
      /* a bad frame, try the next one */
    }
    timer = window.setTimeout(tick, 200);
  };
  timer = window.setTimeout(tick, 200);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
}
