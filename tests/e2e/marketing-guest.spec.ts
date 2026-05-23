/**
 * E2E: Marketing Guest Page
 *
 * EARS-1: REQ-003-AC-011 访客首页展示产品价值说明 + 登录/注册 CTA
 * EARS-5: 访客不可见创作控件
 *
 * 测试策略：
 * - 访客（未登录）访问营销首页 /[locale]
 * - 确认展示价值说明和 CTA 入口
 * - 确认不展示新建/续写/快捷开写等需认证的控件
 */

import { test, expect } from "@playwright/test";

test.describe("Marketing Guest Page", () => {
  test("should display value proposition and auth CTAs for guest visitors", async ({
    page,
  }) => {
    // Act: 未登录访客访问营销首页
    await page.goto("/zh");

    // Assert: 标题和副标题存在
    await expect(page.locator("h1")).toContainText("Write Your Novel");
    await expect(page.locator("text=with AI by Your Side")).toBeVisible();

    // Assert: CTA 按钮存在
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start writing free/i })).toBeVisible();

    // Assert: 特性列表可见（产品价值说明）
    await expect(page.getByText("AI-Powered Story Generation")).toBeVisible();
    await expect(page.getByText("Structured Planning")).toBeVisible();
    await expect(page.getByText("Auto or Manual Writing")).toBeVisible();
    await expect(page.getByText("Export to Multiple Formats")).toBeVisible();

    // Assert: 页脚可见
    await expect(page.locator("footer")).toBeVisible();
  });

  test("should NOT display creation controls for guest visitors", async ({
    page,
  }) => {
    // Act: 未登录访客访问营销首页
    await page.goto("/zh");

    // Assert: 不存在"新建作品"链接
    const allLinks = page.locator("a");
    await expect(allLinks.filter({ hasText: /new project/i })).toHaveCount(0);

    // Assert: 不存在快捷开写输入框
    await expect(
      page.getByPlaceholder("describe your novel idea"),
    ).toHaveCount(0);

    // Assert: 不存在"我的作品"链接
    await expect(allLinks.filter({ hasText: /my works/i })).toHaveCount(0);

    // Assert: 不存在仪表盘链接
    await expect(allLinks.filter({ hasText: /dashboard/i })).toHaveCount(0);
  });

  test("should navigate to sign-in page when clicking Sign In CTA", async ({
    page,
  }) => {
    await page.goto("/zh");

    // Click first "Sign In" link
    await page.getByRole("link", { name: /sign in/i }).first().click();

    // Assert: redirected to sign-in page
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("should navigate to sign-up page when clicking Get Started CTA", async ({
    page,
  }) => {
    await page.goto("/zh");

    // Click "Get Started" link in nav
    await page.getByRole("link", { name: /get started/i }).first().click();

    // Assert: redirected to sign-up page
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("should display How It Works section with 4 steps", async ({ page }) => {
    await page.goto("/zh");

    await expect(page.getByText("How It Works")).toBeVisible();
    await expect(page.getByText("Describe Your Story")).toBeVisible();
    await expect(page.getByText("Extract & Choose Your Path")).toBeVisible();
    await expect(page.getByText("Review the Plan")).toBeVisible();
    await expect(page.getByText("Write & Validate")).toBeVisible();
  });

  test("should work with English locale as well", async ({ page }) => {
    await page.goto("/en");

    await expect(page.locator("h1")).toContainText("Write Your Novel");
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });
});