import { test, expect } from '@playwright/test';

test.describe('My Holiday smoke tests', () => {
  test('app loads and shows welcome wizard', async ({ page }) => {
    await page.goto('/');
    // First-run wizard should appear
    await expect(page.locator('text=Willkommen bei My Holiday')).toBeVisible();
    await expect(page.locator('text=Beschäftigt seit')).toBeVisible();
  });

  test('first-run wizard completes and lands on dashboard', async ({ page }) => {
    await page.goto('/');

    // Step 1: Employment — leave defaults, click Next
    await page.click('text=Weiter');

    // Step 2: Bundesland — leave default, click Next
    await page.click('text=Weiter');

    // Step 3: Vacation days — leave default 30, click Next
    await page.click('text=Weiter');

    // Step 4: Carry-over policy — leave defaults, click Finish
    await page.click('text=Fertigstellen');

    // Should land on Dashboard
    await expect(page.locator('text=Übersicht')).toBeVisible();
  });

  test('plan a vacation via dashboard', async ({ page }) => {
    await page.goto('/');

    // Complete wizard first
    for (let i = 0; i < 4; i++) {
      const btn = page.locator('text=Weiter');
      if (await btn.isVisible()) await btn.click();
    }
    const finishBtn = page.locator('text=Fertigstellen');
    if (await finishBtn.isVisible()) await finishBtn.click();

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

    // Submit
    await page.click('text=Urlaub planen');

    // Vacation should appear in upcoming list
    await expect(page.locator('text=E2E Test Sommerurlaub')).toBeVisible();
  });

  test('switch views', async ({ page }) => {
    await page.goto('/');

    // Complete wizard
    for (let i = 0; i < 4; i++) {
      const btn = page.locator('text=Weiter');
      if (await btn.isVisible()) await btn.click();
    }
    const finishBtn = page.locator('text=Fertigstellen');
    if (await finishBtn.isVisible()) await finishBtn.click();

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
    await expect(page.locator('text=Genutzt')).toBeVisible();
  });

  test('settings modal opens and can change values', async ({ page }) => {
    await page.goto('/');

    // Complete wizard
    for (let i = 0; i < 4; i++) {
      const btn = page.locator('text=Weiter');
      if (await btn.isVisible()) await btn.click();
    }
    const finishBtn = page.locator('text=Fertigstellen');
    if (await finishBtn.isVisible()) await finishBtn.click();

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
