import type { InstitutionId } from '../model';

// Apps whose notifications the phone may pass to Money Hub. Anything else is dropped on the
// phone before it is stored. Package names marked "check" are best guesses: the Capture screen
// lists the apps that actually post notifications on your phone, so you can tick the right ones.
export interface SourceApp { pkg: string; name: string; institution?: InstitutionId; sms?: boolean; check?: boolean }

export const SOURCE_APPS: SourceApp[] = [
  { pkg: 'com.globe.gcash.android', name: 'GCash', institution: 'gcash' },
  { pkg: 'com.paymaya', name: 'Maya', institution: 'maya' },
  { pkg: 'com.paypal.android.p2pmobile', name: 'PayPal', institution: 'paypal' },
  { pkg: 'com.transferwise.android', name: 'Wise', institution: 'wise' },
  { pkg: 'com.bpi.ng.app', name: 'BPI', institution: 'bpi', check: true },
  { pkg: 'ph.com.bdo.retail', name: 'BDO Online', institution: 'bdo', check: true },
  { pkg: 'com.unionbankph.online', name: 'UnionBank Online', institution: 'unionbank', check: true },
  { pkg: 'com.metrobank.mobile', name: 'Metrobank', institution: 'metrobank', check: true },
  { pkg: 'com.securitybank.mobile', name: 'Security Bank', institution: 'securitybank', check: true },
  { pkg: 'ph.gotyme.app', name: 'GoTyme', institution: 'gotyme', check: true },
  { pkg: 'com.samsung.android.messaging', name: 'Samsung Messages (bank SMS)', sms: true },
  { pkg: 'com.google.android.apps.messaging', name: 'Google Messages (bank SMS)', sms: true },
];

export const DEFAULT_ALLOWLIST = SOURCE_APPS.map((a) => a.pkg);

export const sourceApp = (pkg: string) => SOURCE_APPS.find((a) => a.pkg === pkg);
