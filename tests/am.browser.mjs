// Browser-only test fixtures. These routes are never bundled into production.
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.AM_TEST_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const id = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";
const date = "2026-10-19T01:00:00.000Z";
const account = {
  id,
  email: "am_test@bussiness.biz.id",
  domain: "bussiness.biz.id",
  status: "ready",
  created_at: date,
  updated_at: date,
  inbox_count: 1,
};
let syncs = 0;
let generated = false;
let domainsFail = false;
let magicReady = false;
let inboxReady = true;
let sendRequests = 0;
let uncertainSend = false;
let lastSendBody;
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/am/domains" && domainsFail)
    return route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "provider_unreachable",
        message:
          "TmailCloud could not be reached from this site. Please retry.",
      }),
    });
  let data = {};
  if (path === "/api/auth/me")
    data = {
      user: {
        id: "test-user",
        name: "Test User",
        email: "test@example.com",
        isAdmin: false,
        avatar: null,
        createdAt: date,
      },
    };
  else if (path === "/api/am/status")
    data = {
      database: true,
      inbox_adapter: inboxReady,
      detail_adapter: true,
      authorization: {
        valid: false,
        scopes: [],
        reason: "Not configured",
        reference: null,
      },
      provider_contract: false,
      actions: {
        send: {
          ready: magicReady,
          reason:
            "Magic-link request format has not been configured for the provider.",
        },
        verify: { ready: false, reason: "Authorization required" },
        apply: { ready: false, reason: "Authorization required" },
      },
      max_accounts: 20,
    };
  else if (path === "/api/am/domains")
    data = { domains: [{ name: "bussiness.biz.id", is_active: true }] };
  else if (path === "/api/am/accounts") {
    if (route.request().method() === "POST") {
      generated = true;
      data = { account };
    } else data = { items: generated ? [account] : [], next_cursor: null };
  } else if (path.endsWith("/send")) {
    sendRequests++;
    lastSendBody = route.request().postDataJSON();
    data = { status: "awaiting_approval" };
  } else if (path.endsWith("/sync")) {
    syncs++;
    data = { synced: 1 };
  } else if (path.endsWith(`/messages/${messageId}`))
    data = {
      message: {
        id: "provider-message",
        sender: "Alight Creative <mail@alightcreative.com>",
        subject: "Your sign-in request",
        received_at: date,
        html: '<p>Your verification code: <b>123456</b></p><img src="https://tracker.example/pixel"><script>alert(1)</script>',
        text: "Your verification code: 123456",
        raw: null,
        otps: ["123456"],
        links: [
          {
            url: "https://login.alightcreative.com/auth?token=test-only",
            authentication: true,
          },
        ],
        alight_candidate: true,
      },
    };
  else if (path.endsWith("/messages"))
    data = {
      items: [
        {
          id: messageId,
          provider_message_id: "provider-message",
          sender: "Alight Creative",
          subject: "Your sign-in request",
          preview: "Review your sign-in request.",
          received_at: date,
        },
      ],
      next_cursor: null,
    };
  else if (path === `/api/am/accounts/${id}`)
    data = {
      account,
      workflows: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          account_id: id,
          status: uncertainSend ? "uncertain" : "awaiting_email",
          current_step: uncertainSend ? "send" : "mailbox_created",
          error_message: null,
          created_at: date,
          updated_at: date,
        },
      ],
      activity: [
        {
          id: "event-test",
          action: "account_generated",
          status: "completed",
          created_at: date,
        },
      ],
      activity_next_cursor: null,
    };
  else
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, message: "Unexpected test route" }),
    });
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, ...data }),
  });
});
try {
  await page.clock.install();
  await page.goto(process.env.AM_TEST_URL || "http://127.0.0.1:4173/am");
  await expect(
    page.getByRole("heading", { name: "AM Dashboard." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate Account", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Generate Account", exact: true })
    .click();
  await expect(
    page.getByText("am_test@bussiness.biz.id", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request magic link" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: /Alight Creative.*Your sign-in request/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Review & approve" }),
  ).toBeDisabled();
  await expect(page.getByText("123456", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "HTML", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("img, script")).toHaveCount(
    0,
  );
  const before = syncs;
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(20000);
  expect(syncs).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => syncs).toBeGreaterThan(before);
  await mkdir("/workspace/scratch/am-preview", { recursive: true });
  await page.screenshot({
    path: "/workspace/scratch/am-preview/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/workspace/scratch/am-preview/mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  domainsFail = true;
  await page.reload();
  await expect(page.locator("#am-domain")).toBeDisabled();
  await expect(page.locator("#am-domain option")).toHaveText(
    "Could not load domains",
  );
  await expect(
    page.getByRole("button", { name: "Generate Account", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".am-generator")).not.toContainText(
    "No active domains",
  );
  domainsFail = false;
  magicReady = true;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Request magic link", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Request magic link", exact: true })
    .click();
  const approve = page.getByRole("button", {
    name: "Approve this step",
    exact: true,
  });
  await expect(approve).toBeDisabled();
  expect(sendRequests).toBe(0);
  await page
    .getByLabel("I own and control this mailbox and the associated account.")
    .check();
  await expect(approve).toBeDisabled();
  await page
    .getByLabel("I approve sending a sign-in email to this mailbox.")
    .check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect.poll(() => sendRequests).toBe(1);
  await expect(
    page.getByRole("button", { name: "Approve activation", exact: true }),
  ).toBeDisabled();
  uncertainSend = true;
  await page.reload();
  await page.getByRole("button", { name: "Request another email", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("previous request may already have sent an email");
  expect(sendRequests).toBe(1);
  await page.getByLabel("I own and control this mailbox and the associated account.").check();
  await page.getByLabel("I approve sending a sign-in email to this mailbox.").check();
  await page.getByRole("button", { name: "Approve this step", exact: true }).click();
  await expect.poll(() => sendRequests).toBe(2);
  expect(lastSendBody.acknowledge_resend).toBe(true);
  await expect(page.getByRole("button", { name: "Approve activation", exact: true })).toBeDisabled();
  inboxReady = false;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Inbox sync is unavailable");
  await expect(page.getByText("Auto-sync unavailable", { exact: true })).toBeVisible();
  const pausedSyncs = syncs;
  await page.clock.fastForward(15000);
  expect(syncs).toBe(pausedSyncs);
  inboxReady = true;
  await page.getByRole("button", { name: "Check connection", exact: true }).click();
  await expect.poll(() => syncs).toBeGreaterThan(pausedSyncs);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "AM browser checks passed: generation, inbox, authorization gates, sanitized HTML, visibility pause/resume, responsive layout.",
  );
} finally {
  await browser.close();
}
