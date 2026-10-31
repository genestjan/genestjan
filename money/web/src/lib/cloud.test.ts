import { checkCloudConfig, cleanCloudKey, cleanCloudUrl, cloudConfig, cloudError, saveCloudConfig } from './cloud';
import { AppError } from './problems';

const URL_ = 'https://abcdefghijklmnop.supabase.co';
const KEY = 'sb_publishable_abcdefghijklmnop';

describe('cloud address', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('keeps just the project address, whatever was copied', () => {
    for (const raw of [
      URL_,
      `${URL_}/`,
      `${URL_}/rest/v1/`, // sent sign-up to the database service: "Invalid path specified in request URL"
      `${URL_}/rest/v1`,
      `  ${URL_}/auth/v1  \n`,
      'abcdefghijklmnop.supabase.co',
      `"${URL_}"`,
      'HTTPS://ABCDEFGHIJKLMNOP.SUPABASE.CO/rest/v1/',
      'http://abcdefghijklmnop.supabase.co',
      'https://supabase.com/dashboard/project/abcdefghijklmnop/settings/api',
    ]) expect(cleanCloudUrl(raw), raw).toBe(URL_);
  });

  it('strips spaces, line breaks and quotes from the key', () => {
    expect(cleanCloudKey(` ${KEY}\n`)).toBe(KEY);
    expect(cleanCloudKey('"sb_publishable_abc 123"')).toBe('sb_publishable_abc123');
  });

  it('cleans the values built into the app', () => {
    vi.stubEnv('VITE_SUPABASE_URL', `${URL_}/rest/v1/`);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', `${KEY}\n`);
    expect(cloudConfig()).toEqual({ url: URL_, key: KEY });
  });

  it('swaps the two back when they were pasted the wrong way round', () => {
    saveCloudConfig({ url: KEY, key: `${URL_}/` });
    expect(cloudConfig()).toEqual({ url: URL_, key: KEY });
  });

  it('checks the cleaned values', () => {
    expect(checkCloudConfig(URL_, KEY)).toBeNull();
    expect(checkCloudConfig('https://example.com', KEY)).toMatch(/Project URL/);
    expect(checkCloudConfig(URL_, 'sb_secret_abcdefghijklmnop')).toMatch(/publishable/);
  });
});

describe('cloud errors', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', URL_);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', KEY);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('says what to fix and keeps the exact error for a screenshot', () => {
    const e = cloudError({ name: 'AuthApiError', status: 404, message: 'Invalid path specified in request URL' });
    expect(e).toBeInstanceOf(AppError);
    expect(e.message).toMatch(/wrong cloud address/);
    expect(e.detail).toBe(`AuthApiError 404: Invalid path specified in request URL · ${URL_}`);
  });

  it('keeps database error codes', () => {
    const e = cloudError({ message: 'permission denied for table money_records', code: '42501' });
    expect(e.message).toBe('permission denied for table money_records');
    expect(e.detail).toMatch(/^42501: permission denied/);
  });
});
