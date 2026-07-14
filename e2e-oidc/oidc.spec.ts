import { test, expect, type Page } from '@playwright/test';

/**
 * Full multi-user browser journey against a real (mock) IdP: the login
 * redirect, the session cookie round-trip, a cookie-authenticated write, and
 * logout. The mock IdP auto-approves its preset user, so "Sign in" completes
 * the OIDC flow without a credential form.
 */

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  // AuthGate shows the login page until the session cookie exists.
  const signInLink = page.getByRole('link', { name: /Anmelden|Sign in/ });
  await expect(signInLink).toBeVisible();
  await signInLink.click();
  // login → mock IdP → callback → back on the app, authenticated.
  await expect(page).toHaveURL(/localhost:3001\/?$/);
}

/** The E2E user is brand new, so the first-run wizard appears once. */
async function completeWizardIfPresent(page: Page): Promise<void> {
  const wizardHeading = page.locator('text=Willkommen bei My Holiday');
  try {
    await wizardHeading.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }
  await page.locator('input[type="date"]').first().fill('2020-01-01');
  await page.click('text=Weiter');
  await page.click('text=Weiter');
  await page.click('text=Weiter');
  await page.click('text=Fertigstellen');
  await expect(wizardHeading).toBeHidden();
}

test('OIDC login, cookie-authenticated booking, and logout', async ({ page }, testInfo) => {
  await signIn(page);
  await completeWizardIfPresent(page);

  // Authenticated as the IdP user — the nav shows their name + a logout control.
  await expect(page.locator('.nav-account-name')).toHaveText('E2E User');

  // A write proves the session cookie authenticates POST /api/v1/periods.
  // The dashboard "upcoming" list is future-and-current-year, so book a
  // range a few weeks out; offset by the retry index so a period left by a
  // previous attempt on the persistent E2E DB can't overlap.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() + 21 + testInfo.retry * 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const note = `OIDC E2E ${iso(start)}`;

  await page.click('text=+ Urlaub planen');
  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();
  const dates = modal.locator('input[type="date"]');
  await dates.nth(0).fill(iso(start));
  await dates.nth(1).fill(iso(end));
  const noteInput = modal.locator('input[type="text"]').first();
  if (await noteInput.isVisible()) await noteInput.fill(note);
  await modal.getByRole('button', { name: 'Urlaub planen' }).click();
  await expect(page.locator(`text=${note}`)).toBeVisible();

  // Logout clears the session; the app falls back to the login page.
  await page.locator('.nav-account button').click();
  await expect(page.getByRole('link', { name: /Anmelden|Sign in/ })).toBeVisible();
});
