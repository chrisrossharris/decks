import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Takeoff \+ Estimate Engine/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Create Project/i })).toBeVisible();
});

test('invalid public review token shows invalid message', async ({ page }) => {
  await page.goto('/review/not-a-valid-token');
  await expect(page.getByText(/invalid or expired/i)).toBeVisible();
});
