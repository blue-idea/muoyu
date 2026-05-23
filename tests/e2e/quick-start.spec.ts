/**
 * E2E: Quick Start
 *
 * EARS-3: REQ-003-AC-003 提交描述 → 提取结构化字段
 * EARS-3: REQ-003-AC-004 提取结果页二选一（进入完整向导 / 跳过至规划）
 * EARS-4: REQ-003-AC-006 "跳过至规划" 持久化配置 → 若无 novelName 先 L3 再 L4
 * EARS-4: REQ-003-AC-007 全空提取仅完整向导
 * EARS-5: 访客不可见创作控件（E2E 验证）
 *
 * 测试策略：
 * - 已登录用户进入 /[locale]/quick-start
 * - 输入一段描述并提交
 * - 验证提取结果页展示
 * - 验证二选一按钮（条件显示）
 * - 验证全空场景仅完整向导
 */

import { test, expect } from "@playwright/test";

const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL ?? "test@example.com";
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "password123";

test.describe("Quick Start", () => {
  /**
   * 辅助函数：确保用户已登录
   */
  async function signInIfNeeded(page: import("@playwright/test").Page) {
    // Visit the app — if redirected to sign-in, sign in first
    await page.goto("/zh/dashboard");
    if (page.url().includes("/sign-in")) {
      // Sign in with test credentials
      await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
      await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
    }
  }

  test("should show quick start page for authenticated user", async ({ page }) => {
    await signInIfNeeded(page);

    // Navigate to quick-start page
    await page.goto("/zh/quick-start");

    // Assert: page heading visible
    await expect(page.getByRole("heading", { name: /quick start/i })).toBeVisible();

    // Assert: description textarea visible
    await expect(
      page.getByPlaceholder(/describe your novel idea/i),
    ).toBeVisible();

    // Assert: submit button visible
    await expect(
      page.getByRole("button", { name: /extract key elements/i }),
    ).toBeVisible();
  });

  test("should show extraction result with two path choices when extraction succeeds", async ({
    page,
  }) => {
    await signInIfNeeded(page);
    await page.goto("/zh/quick-start");

    // Fill in a detailed description (includes genre keywords, protagonist, conflict)
    const description =
      "A modern urban fantasy where a young coffee shop barista discovers she is the last descendant of an ancient order of dragon guardians. She must learn to control her fire powers while being hunted by a secret society.";
    await page
      .getByPlaceholder(/describe your novel idea/i)
      .fill(description);

    // Submit
    await page.getByRole("button", { name: /extract key elements/i }).click();

    // Wait for result phase
    await expect(
      page.getByRole("heading", { name: /extracted elements/i }),
    ).toBeVisible({ timeout: 10000 });

    // Assert: fields are displayed and editable
    await expect(page.getByLabel(/genre/i)).toBeVisible();
    await expect(page.getByLabel(/protagonist type/i)).toBeVisible();
    await expect(page.getByLabel(/core conflict/i)).toBeVisible();

    // Assert: "Enter Full Wizard" button visible
    await expect(
      page.getByRole("button", { name: /enter full wizard/i }),
    ).toBeVisible();

    // Assert: "Skip to Planning" button visible (because extraction has useful data)
    await expect(
      page.getByRole("button", { name: /skip to planning/i }),
    ).toBeVisible();
  });

  test("should show only Enter Full Wizard when extraction returns empty fields", async ({
    page,
  }) => {
    await signInIfNeeded(page);
    await page.goto("/zh/quick-start");

    // Submit a vague description with no extractable keywords
    await page
      .getByPlaceholder(/describe your novel idea/i)
      .fill("A story happens somewhere with someone.");

    await page.getByRole("button", { name: /extract key elements/i }).click();

    // Wait for result phase
    await expect(
      page.getByRole("heading", { name: /extracted elements/i }),
    ).toBeVisible({ timeout: 10000 });

    // Assert: "Enter Full Wizard" visible
    await expect(
      page.getByRole("button", { name: /enter full wizard/i }),
    ).toBeVisible();

    // Assert: "Skip to Planning" is NOT visible
    await expect(
      page.getByRole("button", { name: /skip to planning/i }),
    ).toHaveCount(0);

    // Assert: notice about needing full wizard
    await expect(
      page.getByText(/not enough elements extracted/i),
    ).toBeVisible();
  });

  test("should allow editing extracted fields before choosing path", async ({
    page,
  }) => {
    await signInIfNeeded(page);
    await page.goto("/zh/quick-start");

    const description =
      "A sci-fi story about a rogue astronaut fighting a corporate conspiracy in deep space.";
    await page.getByPlaceholder(/describe your novel/i).fill(description);
    await page.getByRole("button", { name: /extract key elements/i }).click();

    await expect(
      page.getByRole("heading", { name: /extracted elements/i }),
    ).toBeVisible({ timeout: 10000 });

    // Clear and edit the genre field
    const genreInput = page.getByLabel(/genre/i);
    await genreInput.clear();
    await genreInput.fill("Science Fiction");

    // Assert edited value is present
    await expect(genreInput).toHaveValue("Science Fiction");
  });

  test("should go back to edit description from result page", async ({
    page,
  }) => {
    await signInIfNeeded(page);
    await page.goto("/zh/quick-start");

    await page
      .getByPlaceholder(/describe your novel/i)
      .fill("An urban fantasy about dragons.");
    await page.getByRole("button", { name: /extract key elements/i }).click();

    await expect(
      page.getByRole("heading", { name: /extracted elements/i }),
    ).toBeVisible({ timeout: 10000 });

    // Click "Edit description"
    await page.getByText("← Edit description").click();

    // Assert: back to input phase
    await expect(
      page.getByPlaceholder(/describe your novel idea/i),
    ).toBeVisible();
    // Description should still have the original value
    await expect(
      page.getByPlaceholder(/describe your novel idea/i),
    ).toHaveValue("An urban fantasy about dragons.");
  });

  test("should show validation error for too-short description", async ({
    page,
  }) => {
    await signInIfNeeded(page);
    await page.goto("/zh/quick-start");

    // Submit very short description
    await page.getByPlaceholder(/describe your novel idea/i).fill("Hi");
    await page.getByRole("button", { name: /extract key elements/i }).click();

    // Assert: error shown
    await expect(page.getByText(/at least 5 characters/i)).toBeVisible();
  });

  test("should redirect to sign-in when guest tries to access quick-start", async ({
    page,
  }) => {
    // Clear cookies to ensure guest state
    await page.context().clearCookies();
    await page.goto("/zh/quick-start");

    // Assert: redirected to sign-in with callbackUrl
    await expect(page).toHaveURL(/\/sign-in.*callbackUrl/);
  });
});