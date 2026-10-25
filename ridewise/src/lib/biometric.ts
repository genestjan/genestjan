// Fingerprint / face / screen-lock unlock through WebAuthn (the same thing
// passkeys use). The phone shows its own prompt and RideWise never sees the
// fingerprint. There is no server here, so this is a quick lock for THIS
// phone: it proves the person holding the phone passed the phone's own check.

import { fromB64, randomBytes, toB64 } from './vault';

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (typeof PublicKeyCredential === 'undefined' || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

export async function createBiometric(accountId: string, name: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: toBuf(randomBytes(32)),
      rp: { name: 'RideWise', id: location.hostname },
      user: { id: toBuf(new TextEncoder().encode(accountId)), name, displayName: name },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Nothing was saved.');
  return toB64(cred.rawId);
}

/** Resolves if the person passed the phone's check; throws if they cancelled or failed. */
export async function checkBiometric(credentialId: string): Promise<void> {
  const res = await navigator.credentials.get({
    publicKey: {
      challenge: toBuf(randomBytes(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: toBuf(fromB64(credentialId)), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!res) throw new Error('The check did not finish.');
}

export function friendlyBiometricError(e: unknown): string {
  const name = (e as DOMException)?.name;
  if (name === 'NotAllowedError') return 'That did not work, or it was cancelled. Try again, or use your password.';
  if (name === 'InvalidStateError') return 'Fingerprint is already set up here.';
  if (name === 'NotSupportedError' || name === 'SecurityError') return 'This browser cannot use fingerprint here. Chrome works best.';
  return 'Fingerprint did not work. You can still use your password.';
}
