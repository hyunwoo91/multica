import { test, devices } from "@playwright/test";

// Use iPhone 14 viewport
const iPhone = devices["iPhone 14"];

test.use({ ...iPhone });

const API_BASE = "http://localhost:8080";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://multica:multica@localhost:5434/multica?sslmode=disable";

/**
 * Get a valid JWT token by reading the latest verification code from DB
 * and calling verify-code directly. Falls back to send-code if no code exists.
 */
async function getAuthToken(): Promise<{ token: string; workspaceId: string }> {
  const email = "e2e@multica.ai";
  const pg = await import("pg");
  const client = new pg.default.Client(DATABASE_URL);
  await client.connect();

  try {
    // Try to get an existing unused code
    let codeRow = await client.query(
      "SELECT code FROM verification_code WHERE email = $1 AND used = FALSE AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
      [email],
    );

    if (codeRow.rows.length === 0) {
      // Insert a fresh code directly
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await client.query(
        "INSERT INTO verification_code (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [email, code],
      );
      codeRow = { rows: [{ code }] } as any;
    }

    const code = codeRow.rows[0].code;

    const verifyRes = await fetch(`${API_BASE}/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!verifyRes.ok) {
      throw new Error(`verify-code failed: ${verifyRes.status}`);
    }

    const data = (await verifyRes.json()) as { token: string; user: { id: string } };

    // Get workspace
    const wsRes = await fetch(`${API_BASE}/api/workspaces`, {
      headers: {
        Authorization: `Bearer ${data.token}`,
        "Content-Type": "application/json",
      },
    });
    const workspaces = (await wsRes.json()) as { id: string }[];
    const workspaceId = workspaces[0]?.id ?? "";

    return { token: data.token, workspaceId };
  } finally {
    await client.end();
  }
}

let authData: { token: string; workspaceId: string };

test.beforeAll(async () => {
  authData = await getAuthToken();
});

async function loginAndGo(page: any, path: string) {
  await page.goto("/login");
  await page.evaluate(
    ({ token, wsId }: { token: string; wsId: string }) => {
      localStorage.setItem("multica_token", token);
      if (wsId) localStorage.setItem("multica_workspace_id", wsId);
    },
    { token: authData.token, wsId: authData.workspaceId },
  );
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
}

test.describe("Mobile responsive UI screenshots", () => {
  test("01 - Issues page", async ({ page }) => {
    await loginAndGo(page, "/issues");
    await page.screenshot({
      path: "e2e/screenshots/01-issues-mobile.png",
      fullPage: false,
    });
  });

  test("02 - Sidebar open", async ({ page }) => {
    await loginAndGo(page, "/issues");
    const trigger = page.locator('[data-sidebar="trigger"]');
    if (await trigger.isVisible()) {
      await trigger.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({
      path: "e2e/screenshots/02-sidebar-open-mobile.png",
      fullPage: false,
    });
  });

  test("03 - Inbox page", async ({ page }) => {
    await loginAndGo(page, "/inbox");
    await page.screenshot({
      path: "e2e/screenshots/03-inbox-mobile.png",
      fullPage: false,
    });
  });

  test("04 - Agents page", async ({ page }) => {
    await loginAndGo(page, "/agents");
    await page.screenshot({
      path: "e2e/screenshots/04-agents-mobile.png",
      fullPage: false,
    });
  });

  test("05 - Runtimes page", async ({ page }) => {
    await loginAndGo(page, "/runtimes");
    await page.screenshot({
      path: "e2e/screenshots/05-runtimes-mobile.png",
      fullPage: false,
    });
  });

  test("06 - Skills page", async ({ page }) => {
    await loginAndGo(page, "/skills");
    await page.screenshot({
      path: "e2e/screenshots/06-skills-mobile.png",
      fullPage: false,
    });
  });

  test("07 - Settings page", async ({ page }) => {
    await loginAndGo(page, "/settings");
    await page.screenshot({
      path: "e2e/screenshots/07-settings-mobile.png",
      fullPage: false,
    });
  });

  test("08 - My Issues page", async ({ page }) => {
    await loginAndGo(page, "/my-issues");
    await page.screenshot({
      path: "e2e/screenshots/08-my-issues-mobile.png",
      fullPage: false,
    });
  });
});
