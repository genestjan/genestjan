import type { CapacitorConfig } from '@capacitor/cli';

// Android shell. `android/` is generated in CI with `npx cap add android` and is not committed.
const config: CapacitorConfig = {
  appId: 'com.bikemoko.app',
  appName: 'Bikemoko',
  webDir: 'dist',
  android: { backgroundColor: '#0a0b0d' },
};

export default config;
