import { test, expect } from '@playwright/test';

// The localStorage key used by the app
const USER_STORAGE_KEY = 'poh_demo_user';

// Mock user data for testing
const mockUser = {
  id: 'test-uuid-1234-5678-90ab',
  name: 'John Test User',
  email: 'john.testuser@example.com',
  avatar: 'https://i.pravatar.cc/150?u=test',
  jobTitle: 'Senior Software Engineer',
  bio: 'This is a test bio for the mock user profile. It contains enough text to verify the bio section displays correctly.',
  createdAt: '2024-01-15T10:30:00.000Z',
};

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    // CRUCIAL: Use addInitScript to inject the fake user into localStorage
    // BEFORE the page loads. This bypasses the need for any login flow.
    await page.addInitScript(
      ({ key, user }) => {
        localStorage.setItem(key, JSON.stringify(user));
      },
      { key: USER_STORAGE_KEY, user: mockUser }
    );
  });

  test('displays the injected user name on the profile page', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Click on the Profile tab in the navigation
    await page.click('text=Profile');

    // Assert that the injected user's name is visible
    const nameElement = page.getByTestId('profile-name');
    await expect(nameElement).toBeVisible();
    await expect(nameElement).toHaveText(mockUser.name);
  });

  test('displays all user profile information correctly', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Profile');

    // Verify all profile fields are displayed
    await expect(page.getByTestId('profile-name')).toHaveText(mockUser.name);
    await expect(page.getByTestId('profile-email')).toHaveText(mockUser.email);
    await expect(page.getByTestId('profile-job')).toHaveText(mockUser.jobTitle);
    await expect(page.getByTestId('profile-bio')).toContainText(mockUser.bio);

    // Verify avatar is displayed
    const avatar = page.getByTestId('profile-avatar');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute('src', mockUser.avatar);
  });

  test('reset demo button is visible and clickable', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Profile');

    // Find the reset button
    const resetButton = page.getByTestId('reset-demo-button');
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toHaveText('Reset Demo');
  });

  test('profile tab is highlighted when active', async ({ page }) => {
    await page.goto('/');

    // Click Profile tab
    const profileTab = page.locator('button:has-text("Profile")');
    await profileTab.click();

    // Check the tab has the active color (gold)
    await expect(profileTab).toHaveClass(/text-\[#FFD700\]/);
  });
});

test.describe('Profile without pre-injected user', () => {
  test('generates a new user when localStorage is empty', async ({ page }) => {
    // Don't inject any user - let the app generate one
    await page.goto('/');
    await page.click('text=Profile');

    // Should still display a profile (faker-generated)
    const nameElement = page.getByTestId('profile-name');
    await expect(nameElement).toBeVisible();

    // The name should not be empty
    const nameText = await nameElement.textContent();
    expect(nameText).toBeTruthy();
    expect(nameText!.length).toBeGreaterThan(0);
  });
});
