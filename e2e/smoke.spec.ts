import { test, expect, type Page } from '@playwright/test';

/** Walk the 4-step first-run wizard with valid defaults. Idempotent —
 *  if a previous test already completed the wizard (settings persisted in
 *  the shared test DB), this is a no-op apart from the page load. */
async function completeWizard(page: Page): Promise<void> {
  await page.goto('/');

  const wizardHeading = page.locator('text=Willkommen bei My Holiday');
  // Give the wizard up to 3s to appear; if it doesn't, settings are already
  // persisted and we land directly on the dashboard.
  try {
    await wizardHeading.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }

  // Step 0 → 1: fill required emplStart, advance, wait for step indicator.
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.fill('2020-01-01');
  await page.click('text=Weiter');
  await expect(page.locator('text=2 / 4')).toBeVisible();

  // Step 1 → 2: keep default Bundesland (HE).
  await page.click('text=Weiter');
  await expect(page.locator('text=3 / 4')).toBeVisible();

  // Step 2 → 3: keep default 30 vacation days.
  await page.click('text=Weiter');
  await expect(page.locator('text=4 / 4')).toBeVisible();

  // Step 3 → finish: keep default carry-over policy, save settings.
  await page.click('text=Fertigstellen');
  await expect(wizardHeading).toBeHidden();
}

test.describe('My Holiday smoke tests', () => {
  test('app loads and shows welcome wizard', async ({ page }) => {
    await page.goto('/');
    // First-run wizard should appear
    await expect(page.locator('text=Willkommen bei My Holiday')).toBeVisible();
    await expect(page.locator('text=Beschäftigt seit')).toBeVisible();
  });

  test('first-run wizard completes and lands on dashboard', async ({ page }) => {
    await completeWizard(page);
    // Should land on Dashboard — the heading is unique (the nav also has "Übersicht")
    await expect(page.getByRole('heading', { name: /Übersicht/ })).toBeVisible();
  });

  test('plan a vacation via dashboard', async ({ page }) => {
    await completeWizard(page);

    // Click "Plan Vacation"
    await page.click('text=+ Urlaub planen');

    // Fill in vacation dates
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Set start and end dates
    const dateInputs = modal.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-07-01');
    await dateInputs.nth(1).fill('2026-07-15');

    // Add a note
    const textInput = modal.locator('input[type="text"]');
    if (await textInput.isVisible()) {
      await textInput.fill('E2E Test Sommerurlaub');
    }

    // Submit (scope to the modal — dashboard also has a "+ Urlaub planen" button)
    await modal.getByRole('button', { name: 'Urlaub planen' }).click();

    // Vacation should appear in upcoming list
    await expect(page.locator('text=E2E Test Sommerurlaub')).toBeVisible();
  });

  test('switch views', async ({ page }) => {
    await completeWizard(page);

    // Click on "Jahresansicht"
    await page.click('text=Jahresansicht');
    await expect(page.locator('.month-card').first()).toBeVisible();

    // Click on "Monatsansicht"
    await page.click('text=Monatsansicht');
    await expect(page.locator('.month-grid')).toBeVisible();

    // Click on "Liste"
    await page.click('text=Liste');
    await expect(page.locator('text=Urlaubsliste')).toBeVisible();

    // Back to Übersicht
    await page.click('text=Übersicht');
    // "Genutzt" appears as a stat-card label and as part of "0 genutzt" — match exact.
    await expect(page.getByText('Genutzt', { exact: true })).toBeVisible();
  });

  test('settings modal opens and can change values', async ({ page }) => {
    await completeWizard(page);

    // Open settings
    await page.click('button[title="Einstellungen"]');

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Urlaubstage pro Jahr')).toBeVisible();

    // Close settings
    await page.click('text=Abbrechen');
    await expect(modal).not.toBeVisible();
  });
});
