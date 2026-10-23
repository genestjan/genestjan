import { expect, test, type Page } from '@playwright/test';
import { mockServices } from './mocks';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
});

async function planGensanDavao(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Plan My Ride' }).click();
  await expect(page.getByRole('heading', { name: 'Plan a Ride' })).toBeVisible();

  // Start: six Jollibee branches -> the app must make the rider choose.
  await page.getByLabel('Search for Starting point').fill('Jollibee General Santos');
  await page.getByRole('group', { name: 'Starting point' }).getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('6 matches found. Choose the right one; RideWise will not guess.')).toBeVisible();
  await page.getByRole('button', { name: /Jollibee Jollibee, Digos-Makar Road, San Vicente, Lagao/ }).click();
  await expect(page.getByText('Selected: Jollibee')).toBeVisible();
  await expect(page.getByText(/^6\.12703\d, 125\.19527\d$/)).toBeVisible();

  await page.getByLabel('Search for Destination').fill('Ecoland Terminal Davao');
  await page.getByRole('group', { name: 'Destination' }).getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: /Davao City Overland Transport Terminal/ }).click();
  await expect(page.getByText('Selected: Davao City Overland Transport Terminal')).toBeVisible();

  await page.getByRole('button', { name: 'Calculate bicycle route' }).click();
  await expect(page.getByRole('heading', { name: 'Compare routes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '135.1 km' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '292.8 km' })).toBeVisible();
  await expect(page.getByText('A mapped route is a planning aid')).toBeVisible();
}

test('plans GenSan to Davao with a real route, builds and edits the schedule, and keeps it after reload', async ({ page }) => {
  await mockServices(page);
  await planGensanDavao(page);

  await page.getByRole('button', { name: '5. Group' }).click();
  await page.getByRole('button', { name: 'Find real stops and build my schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Pit Stop Schedule' })).toBeVisible();

  const cards = page.locator('li.card').filter({ hasText: /^STOP 0/ });
  await expect(cards.first()).toContainText('TEST Place');
  await expect(page.getByText('TEST no coordinates')).toHaveCount(0);
  const count = await cards.count();
  expect(count).toBeGreaterThan(4);

  // Changing stop 1's duration pushes stop 2's arrival back by the same amount.
  const arrival2 = async () => (await cards.nth(1).locator('p.text-2xl').innerText()).trim();
  const before = await arrival2();
  await cards.nth(0).getByText('Edit this stop').click();
  await cards.nth(0).getByRole('button', { name: '5 minutes longer' }).click();
  const after = await arrival2();
  const toMin = (s: string) => {
    const m = /(\d+):(\d+)\s*(am|pm)/i.exec(s)!;
    return ((Number(m[1]) % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + Number(m[2]);
  };
  expect(toMin(after) - toMin(before)).toBe(5);

  await cards.nth(0).getByRole('button', { name: 'Mark arrived' }).click();
  await expect(cards.nth(0)).toContainText('Arrived');

  await page.reload();
  await expect(page.locator('li.card').filter({ hasText: /^STOP 0/ }).first()).toContainText('Arrived');

  // Map shows the route distance and the place detail with source and hours label.
  await page.getByRole('link', { name: 'Map' }).first().click();
  await expect(page.getByText(/135\.1 km by bicycle/)).toBeVisible();
  await page.getByText('List view').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /TEST Place 2/ }).first().click();
  await expect(page.getByText('OpenStreetMap listing, not verified').first()).toBeVisible();
  await expect(page.getByText('Hours not verified').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google Maps' })).toHaveAttribute('href', /travelmode=bicycling/);
});

test('place search failure is reported honestly and nothing is invented', async ({ page }) => {
  await mockServices(page, { overpass: 'fail' });
  await planGensanDavao(page);
  await page.getByRole('button', { name: '5. Group' }).click();
  await page.getByRole('button', { name: 'Find real stops and build my schedule' }).click();
  await expect(page.getByText(/Place search is unavailable right now/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/No places could be loaded, so no stops were suggested/)).toBeVisible();
  await page.getByRole('link', { name: 'Stops' }).click();
  await expect(page.locator('li.card').filter({ hasText: /^STOP 0/ })).toHaveCount(0);
  await expect(page.getByText(/No mapped water or food stop between km 0.0 and km 135.1/)).toBeVisible();
});

test('sample ride is labelled as demo data and works with the bundled real route', async ({ page }) => {
  await mockServices(page);
  await page.goto('./');
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await expect(page.getByText('Sample: demonstration data')).toBeVisible();
  await expect(page.getByText(/135\.1 km by bicycle/)).toBeVisible();
  await page.getByRole('button', { name: 'Find real stops along this route' }).click();
  await expect(page.getByText(/places found/)).toBeVisible();
  await page.getByRole('button', { name: 'Suggest pit stops from these places' }).click();
  await page.getByRole('link', { name: 'Stops' }).click();
  await expect(page.locator('li.card').filter({ hasText: /^STOP 01/ })).toBeVisible();
});

test('live ride: unwell check-in pauses pressure, shows emergency help; location denied falls back to manual', async ({ page }) => {
  await mockServices(page);
  await page.goto('./');
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await page.getByRole('link', { name: 'Ride' }).click();
  await expect(page.getByText('Use your phone only when safely stopped')).toBeVisible();
  await page.getByRole('button', { name: 'Feeling good' }).click();
  await page.getByRole('button', { name: 'Start ride' }).click();
  await expect(page.getByRole('status', { name: 'Rider status: Ready' })).toBeVisible();

  await page.getByRole('button', { name: 'How am I feeling?' }).click();
  await page.getByRole('button', { name: 'Dizzy or unwell' }).click();
  await expect(page.getByRole('status', { name: 'Rider status: Stop and assess' })).toBeVisible();
  await expect(page.getByText(/do not ride while you feel dizzy or unwell/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible(); // ride was paused, not pushed on

  await page.getByRole('button', { name: 'Emergency help' }).first().click();
  await expect(page.getByRole('link', { name: 'Call 911' })).toHaveAttribute('href', 'tel:911');
  await page.getByRole('button', { name: 'Close emergency panel' }).click();

  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText(/Location permission denied|Location unavailable/)).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('From last stop reached (manual)')).toBeVisible();
});

test('checklist flags safety-critical problems', async ({ page }) => {
  await mockServices(page);
  await page.goto('./#/checklists');
  await page.getByRole('button', { name: 'Brakes working front and rear: problem' }).click();
  await expect(page.getByRole('alert')).toContainText('Do not ride until this is fixed');
  await page.getByRole('button', { name: 'Helmet fitted and secured: OK' }).click();
  await expect(page.getByText('2 of 22 checked')).toBeVisible();
});

test('mobile navigation and offline indicator', async ({ page, context }) => {
  await mockServices(page);
  await page.goto('./');
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  const bottom = page.getByRole('navigation', { name: 'Main navigation' }).last();
  await expect(bottom).toBeVisible();
  await bottom.getByRole('button', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Ride History' }).click();
  await expect(page.getByRole('heading', { name: 'Ride History' })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText('Offline: saved plans only')).toBeVisible();
  await bottom.getByRole('link', { name: 'Stops' }).click();
  await expect(page.getByRole('heading', { name: 'Pit Stop Schedule' })).toBeVisible();
  await context.setOffline(false);
});

test('form validation rejects an impossible speed', async ({ page }) => {
  await mockServices(page);
  await page.goto('./');
  await page.getByRole('button', { name: /Start Sample Ride/ }).click();
  await expect(page.getByText('Sample: demonstration data')).toBeVisible();
  await page.goto('./#/plan?step=4');
  await page.getByLabel('Group moving speed (km/h)').fill('0');
  await expect(page.getByText('Riding speed must be more than 0 km/h.')).toBeVisible();
  await page.getByRole('link', { name: 'Stops' }).click();
  await expect(page.getByText('Riding speed must be more than 0 km/h.')).toBeVisible();
});
