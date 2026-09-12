import assert from "node:assert/strict";
import { mkdtemp, cp, writeFile, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { stripVTControlCharacters } from "node:util";

function localOrigin(output) {
  // Require Vite's trailing slash so a split port cannot become a partial URL.
  return stripVTControlCharacters(output).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)\//)?.[1];
}

// Exercise accumulated chunks, including a split ANSI sequence and port.
let coloredOutput = "";
for (const chunk of ["  Local: \u001b[", "36mhttp://127.0.0.1:45", "801/\u001b[39m\n"]) {
  coloredOutput += chunk;
  assert.equal(localOrigin(coloredOutput), coloredOutput.endsWith("\n") ? "http://127.0.0.1:45801" : undefined);
}
assert.equal(localOrigin("  Local: http://127.0.0.1:5193/\n"), "http://127.0.0.1:5193");
const root = resolve("."),
  directory = await mkdtemp(join(tmpdir(), "happytohelp-browser-"));
for (const item of [
  "src",
  "public",
  "migrations",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "wrangler.jsonc",
])
  await cp(join(root, item), join(directory, item), { recursive: true });
await symlink(
  join(root, "node_modules"),
  join(directory, "node_modules"),
  "dir",
);
const bootstrapToken = randomBytes(32).toString("hex"),
  password = randomBytes(24).toString("hex");
await writeFile(
  join(directory, ".dev.vars"),
  `H2H_BOOTSTRAP_TOKEN=${bootstrapToken}\n`,
  { mode: 0o600 },
);
const migrate = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "migrations",
    "apply",
    "happytohelp",
    "--local",
  ],
  { cwd: directory, encoding: "utf8" },
);
assert.equal(migrate.status, 0, migrate.stderr);
const testEnvironment = { ...process.env };
for (const name of ['CLOUDFLARE_ENV', 'H2H_WRANGLER_CONFIG', 'H2H_PERSIST_PATH', 'SENDGRID_API_KEY', 'MAIL_FROM', 'APP_ORIGIN']) delete testEnvironment[name];
const server = spawn(
  process.execPath,
  [
    join(root, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "0",
  ],
  { cwd: directory, env: testEnvironment, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "",
  origin;
server.stdout.on("data", (chunk) => {
  logs += chunk;
  origin ??= localOrigin(logs);
});
server.stderr.on("data", (chunk) => (logs += chunk));
let browser;
try {
  const deadline = Date.now() + 90000;
  while (!origin && Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(origin, logs);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1024 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByLabel("Your name").fill("Acceptance Owner");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Deployment bootstrap token").fill(bootstrapToken);
  await page.getByRole("button", { name: "Create owner account" }).click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByLabel("Workspace name").fill("Acceptance workspace");
  await page.getByLabel("Absolute local folder hint").fill(directory);
  await page.getByRole("button", { name: "Add workspace" }).click();
  await page
    .getByRole("heading", { name: "Acceptance workspace", exact: true })
    .waitFor();
  await page.getByLabel("Connection name").fill("Acceptance agent");
  await page.getByRole("checkbox", { name: "Acceptance workspace" }).check();
  await page.getByRole("button", { name: "Create scoped credential" }).click();
  await page.locator(".token").waitFor();
  const token = await page.locator(".token").innerText();
  assert.match(token, /^[a-f0-9]{64}$/);
  await page.getByRole("button", { name: "I've saved it" }).click();
  await page.getByRole("button", { name: "Requests", exact: true }).click();
  await page.getByRole("button", { name: "New request" }).click();
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Verify the workspace evidence");
  await page.getByLabel("Customer email").fill("customer@example.test");
  await page
    .getByLabel("Customer request", { exact: true })
    .fill("Please investigate the observed file content.");
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Instructions and limits")
    .fill(
      "Read the evidence file only. Report its checksum. Do not change anything or send a reply.",
    );
  await page
    .getByLabel("Agent connection")
    .selectOption({ label: "Acceptance agent" });
  await page.getByRole("button", { name: "Delegate to agent" }).click();
  await page.getByRole("heading", { name: "Investigate authority" }).waitFor();
  async function agent(path, body) {
    const response = await fetch(`${origin}/api/agent/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(response.ok, true, await response.clone().text());
    return response.json();
  }
  const claim = await agent("claim", { sessionId: randomUUID() });
  const job = claim.job;
  assert.ok(job?.id, JSON.stringify(claim));
  await agent(`jobs/${job.id}/progress`, {
    runId: job.runId,
    message: "Reading the actual isolated workspace evidence.",
    eventId: randomUUID(),
  });
  await agent(`jobs/${job.id}/result`, {
    runId: job.runId,
    eventId: randomUUID(),
    status: "needs_input",
    result: {
      summary: "Need the intended record.",
      verified: false,
      question: "Which evidence file should I inspect?",
    },
  });
  await page
    .getByRole("heading", { name: "The agent needs your input" })
    .waitFor();
  await page
    .getByLabel("Your answer")
    .fill("Read package.json and report its package name.");
  await page.getByRole("button", { name: "Send input and resume" }).click();
  const screenshot = await page.screenshot();
  const uploaded = await fetch(
    `${origin}/api/agent/jobs/${job.id}/attachments?runId=${job.runId}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "image/png",
      },
      body: screenshot,
    },
  );
  assert.equal(uploaded.status, 201);
  const attachment = await uploaded.json();
  const image = await page
    .context()
    .request.get(`${origin}/api/attachments/${attachment.attachmentId}`);
  assert.deepEqual(await image.body(), screenshot);
  const observed = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  ).name;
  assert.equal(observed, "support-happytohelp");
  await agent(`jobs/${job.id}/result`, {
    runId: job.runId,
    eventId: randomUUID(),
    status: "completed",
    result: {
      summary: "The actual local package is support-happytohelp.",
      verified: true,
      attachment_ids: [attachment.attachmentId],
      actions: [
        {
          description: "Read the isolated package.json without changes.",
          evidence: `Observed package name: ${observed}`,
        },
      ],
      replies: [
        {
          id: "reply-evidence",
          title: "Confirm inspection",
          body: "The workspace package identity was confirmed.",
        },
      ],
    },
  });
  await page
    .getByRole("complementary")
    .getByText("The actual local package is support-happytohelp.")
    .waitFor();
  await page.screenshot({ path: join(directory, "request-evidence.png") });
  await page
    .getByRole("button", { name: "Evidence reviewed · Resolve" })
    .click();
  await page
    .locator(".workbench-header .badge")
    .filter({ hasText: "resolved" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(directory, "request-mobile.png") });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile horizontal overflow",
  );
  assert.deepEqual(errors, []);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  const denied = await page.context().request.get(`${origin}/api/requests`);
  assert.equal(denied.status(), 401);
  console.log(
    `Browser + real Worker/D1 journey passed. Evidence: ${directory}`,
  );
} catch (error) {
  console.error(logs.slice(-5000));
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
