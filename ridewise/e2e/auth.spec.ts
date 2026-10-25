import { expect, test } from '@playwright/test';
import { mockServices } from './mocks';
import { PASSWORD, addFingerprintSensor, register, skipTutorial, startApp } from './helpers';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await mockServices(page);
});
test.afterEach(() => expect(errors).toEqual([]));

test('a new rider registers, sees the lesson, and everything is saved after a reload', async ({ page }) => {
  await page.goto('./');
  await register(page, 'Jan', 'open');
  // The lesson starts by itself the first time.
  const lesson = page.getByRole('dialog', { name: 'How to use RideWise' });
  await expect(lesson.getByRole('heading', { name: "Hi! I'm Wheelie!" })).toBeVisible();
  await lesson.getByRole('button', { name: "Let's go!" }).click();
  await expect(lesson.getByRole('heading', { name: /pick where to start/i })).toBeVisible();
  for (let i = 0; i < 7; i++) await lesson.getByRole('button', { name: 'Next' }).click();
  await expect(lesson.getByRole('heading', { name: "You're ready!" })).toBeVisible();
  await lesson.getByRole('button', { name: 'Try a pretend ride' }).click();
  await expect(page.getByRole('definition').filter({ hasText: /^135\.1 km$/ })).toBeVisible();

  // Reload: opens straight away (Just open), the sample is still there, the lesson does not come back.
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'How to use RideWise' })).toHaveCount(0);
  await page.goto('./#/history');
  await expect(page.getByText('Sample: GenSan to Davao (demo data)')).toBeVisible();
});

test('the password is checked, and a wrong one is refused kindly', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('What is your name?').fill('Jan');
  await page.getByLabel('Make a secret password').fill('short');
  await page.getByLabel('Type the password again').fill('short');
  await page.getByRole('button', { name: 'Make my account' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 8');
  await page.getByLabel('Make a secret password').fill(PASSWORD);
  await page.getByLabel('Type the password again').fill('different-password');
  await page.getByRole('button', { name: 'Make my account' }).click();
  await expect(page.getByRole('alert')).toContainText('not the same');
  await page.getByLabel('Type the password again').fill(PASSWORD);
  await page.getByRole('button', { name: 'Make my account' }).click();
  await expect(page.getByRole('heading', { name: 'Almost done, Jan!' })).toBeVisible();
  await page.getByText('My password', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await skipTutorial(page);

  // Lock, then try a wrong password, then the right one.
  await page.getByRole('button', { name: "Jan's menu" }).click();
  await page.getByRole('menuitem', { name: 'Lock for now' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Jan!' })).toBeVisible();
  await page.getByLabel('Your password').fill('not-my-password');
  await page.getByRole('button', { name: 'Open my rides' }).click();
  await expect(page.getByRole('alert')).toContainText('does not match');
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open my rides' }).click();
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible();
});

test('password mode asks again after a reload, and the saved data is encrypted on disk', async ({ page }) => {
  await page.goto('./');
  await register(page, 'Jan', 'password');
  await skipTutorial(page);
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await expect(page.getByRole('heading', { name: 'Route Details' })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: /^135\.1 km$/ })).toBeVisible();
  await page.waitForTimeout(800); // let the save finish

  // Nothing readable is stored: the route name must not appear in browser storage.
  const plain = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    let text = '';
    for (const info of dbs) {
      await new Promise<void>((resolve) => {
        const open = indexedDB.open(info.name!);
        open.onsuccess = () => {
          const db = open.result;
          const names = Array.from(db.objectStoreNames);
          if (!names.length) return resolve();
          const tx = db.transaction(names, 'readonly');
          let left = names.length;
          for (const n of names) {
            const store = tx.objectStore(n);
            const keys = store.getAllKeys();
            const vals = store.getAll();
            vals.onsuccess = () => {
              text += JSON.stringify(keys.result) + JSON.stringify(vals.result.map((r) => (r instanceof CryptoKey ? 'CryptoKey' : r)));
              if (--left === 0) resolve();
            };
            vals.onerror = () => --left === 0 && resolve();
          }
        };
        open.onerror = () => resolve();
      });
    }
    return text;
  });
  expect(plain).toContain('ridewise:data:');
  expect(plain).not.toContain('GenSan');
  expect(plain).not.toContain('Digos');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, Jan!' })).toBeVisible();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open my rides' }).click();
  await page.goto('./#/history');
  await expect(page.getByText('Sample: GenSan to Davao (demo data)')).toBeVisible();
});

test('fingerprint unlock works, and failing the fingerprint falls back to the password', async ({ page }) => {
  const sensor = await addFingerprintSensor(page);
  await page.goto('./');
  await register(page, 'Jan', 'fingerprint');
  await skipTutorial(page);
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await expect(page.getByRole('heading', { name: 'Route Details' })).toBeVisible();
  await page.waitForTimeout(500);

  await page.reload();
  // The phone's check happens by itself on this screen, and passes.
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('definition').filter({ hasText: /^135\.1 km$/ })).toBeVisible();

  // Now the fingerprint fails.
  await sensor.setVerified(false);
  await page.getByRole('button', { name: "Jan's menu" }).click();
  await page.getByRole('menuitem', { name: 'Lock for now' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Jan!' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/did not work|cancelled/i, { timeout: 15000 });
  // Password still works.
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open my rides' }).click();
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible();

  // And with the sensor happy again, the button opens it.
  await page.getByRole('button', { name: "Jan's menu" }).click();
  await sensor.setVerified(true);
  await page.getByRole('menuitem', { name: 'Lock for now' }).click();
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible({ timeout: 15000 }); // opened by itself
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible();
});

test('two riders on one phone cannot see each other\'s rides', async ({ page }) => {
  await startApp(page, 'Jan');
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await expect(page.getByRole('heading', { name: 'Route Details' })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: /^135\.1 km$/ })).toBeVisible();

  await page.getByRole('button', { name: "Jan's menu" }).click();
  await page.getByRole('menuitem', { name: /switch rider/i }).click();
  await page.getByRole('button', { name: 'Add another rider' }).click();
  await register(page, 'Mia', 'password');
  await skipTutorial(page);
  await page.goto('./#/history');
  await expect(page.getByText('No saved plans')).toBeVisible();

  await page.getByRole('button', { name: "Mia's menu" }).click();
  await page.getByRole('menuitem', { name: /switch rider/i }).click();
  await page.getByRole('button', { name: /Jan/ }).first().click();
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible(); // Jan is "Just open"
  await page.goto('./#/history');
  await expect(page.getByText('Sample: GenSan to Davao (demo data)')).toBeVisible();
});

test('the lesson can be skipped, comes back from Help, and a shared link works without an account', async ({ page, context }) => {
  await startApp(page);
  await page.goto('./#/help');
  await page.getByRole('button', { name: 'Show me again' }).click();
  await expect(page.getByRole('dialog', { name: 'How to use RideWise' })).toBeVisible();
  await skipTutorial(page);

  await page.goto('./#/');
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await expect(page.getByRole('heading', { name: 'Route Details' })).toBeVisible();
  await page.goto('./#/schedule');
  await page.getByRole('button', { name: 'Share plan' }).click();
  const url = await page.getByLabel('Share link').inputValue();

  const stranger = await (await page.context().browser()!.newContext()).newPage(); // no account on this phone
  await mockServices(stranger);
  await stranger.goto(url);
  await expect(stranger.getByText(/A friend shared this ride with you/)).toBeVisible();
  await expect(stranger.getByText(/Stop 1:/).first()).toBeVisible();
  await expect(stranger.getByRole('link', { name: 'Make an account to keep a copy' })).toBeVisible();
  await context.close().catch(() => undefined);
});

test('changing the password works and the old one stops working', async ({ page }) => {
  await page.goto('./');
  await register(page, 'Jan', 'password');
  await skipTutorial(page);
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Change my password' }).click();
  await page.getByLabel('My password now').fill(PASSWORD);
  await page.getByLabel('My new password').fill('a-brand-new-one');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Your password was changed.')).toBeVisible();
  await page.getByRole('button', { name: 'Lock for now' }).click();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open my rides' }).click();
  await expect(page.getByRole('alert')).toContainText('does not match');
  await page.getByLabel('Your password').fill('a-brand-new-one');
  await page.getByRole('button', { name: 'Open my rides' }).click();
  await expect(page.getByRole('button', { name: "Jan's menu" })).toBeVisible();
});
