import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'bicycle-4-life';

/** Make an account the way a rider would. `open` = "Just open" (no lock) keeps later reloads simple. */
export async function register(page: Page, name = 'Jan', mode: 'open' | 'password' | 'fingerprint' = 'open') {
  await expect(page.getByRole('heading', { name: /Hi! I'm Wheelie\.|A new rider!/ })).toBeVisible();
  await page.getByLabel('What is your name?').fill(name);
  await page.getByLabel('Make a secret password').fill(PASSWORD);
  await page.getByLabel('Type the password again').fill(PASSWORD);
  await page.getByRole('button', { name: 'Make my account' }).click();
  await expect(page.getByRole('heading', { name: `Almost done, ${name}!` })).toBeVisible();
  const label = { open: 'Just open', password: 'My password', fingerprint: 'Fingerprint or face' }[mode];
  await page.getByText(label, { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

export async function skipTutorial(page: Page) {
  await expect(page.getByRole('dialog', { name: 'How to use RideWise' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('dialog', { name: 'How to use RideWise' })).toHaveCount(0);
}

/** Open the app, make an account, skip the lesson. Lands on Home. */
export async function startApp(page: Page, name = 'Jan') {
  await page.goto('./');
  await register(page, name);
  await skipTutorial(page);
  await expect(page.getByRole('button', { name: 'Plan My Ride' }).first()).toBeVisible();
}

/** A fake fingerprint sensor, so the real WebAuthn flow can run in a test browser. */
export async function addFingerprintSensor(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId, setVerified: (v: boolean) => cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: v }) };
}
