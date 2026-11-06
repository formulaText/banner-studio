import {
  chromium,
  devices,
  expect,
} from "../app/node_modules/@playwright/test/index.mjs";
import { readdir, readFile, stat } from "node:fs/promises";
const base = "http://127.0.0.1:4173/banner-studio/";
const entries = await readdir(new URL("../app/dist/", import.meta.url));
expect(entries.sort()).toEqual(["assets", "index.html"]);
const html = await readFile(
  new URL("../app/dist/index.html", import.meta.url),
  "utf8",
);
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
expect(assets.length).toBeGreaterThan(0);
for (const asset of assets) {
  expect(asset.startsWith("/banner-studio/assets/")).toBe(true);
  expect(
    (
      await stat(
        new URL(
          "../app/dist/" + asset.replace("/banner-studio/", ""),
          import.meta.url,
        ),
      )
    ).isFile(),
  ).toBe(true);
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
try {
  for (const [name, options] of [
    ["desktop", { viewport: { width: 1440, height: 1000 } }],
    ["mobile-emulation", devices["Pixel 7"]],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    const badResponses = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) badResponses.push(r.url());
    });
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(base);
    await expect(page.getByLabel("合言葉", { exact: true })).toBeVisible();
    await expect(page.getByLabel("タイトル", { exact: true })).toHaveCount(0);
    await page.getByLabel("合言葉", { exact: true }).fill("wrong");
    await page.getByRole("button", { name: "制作室を開く" }).click();
    await expect(page.getByRole("alert")).toContainText("合言葉が違います");
    await page.getByLabel("合言葉", { exact: true }).fill("banner-demo");
    await page.getByRole("button", { name: "制作室を開く" }).click();
    await expect(page.getByLabel("タイトル", { exact: true })).toBeVisible();
    await expect(page.getByText("描画中…")).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("タイトル", { exact: true })).toBeVisible();
    await page.getByLabel("ログアウト").click();
    await page.reload();
    await expect(page.getByLabel("合言葉", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(
      requests.every(
        (url) =>
          url.startsWith(base) ||
          url.startsWith("blob:") ||
          url.startsWith("data:"),
      ),
    ).toBe(true);
    await context.close();
    const fresh = await browser.newContext(options);
    const freshPage = await fresh.newPage();
    await freshPage.goto(base);
    await expect(freshPage.getByLabel("合言葉", { exact: true })).toBeVisible();
    await fresh.close();
    console.log(
      `${name}: PASS initial gate, wrong/correct phrase, reload, logout, fresh session, assets, no page errors`,
    );
  }
  for (const path of [
    "docs/29_GitHubPages公開と簡易パスワード画面.md",
    "banner-webapp-devpack-v0.3.2.zip",
    "src/main.tsx",
    "tests/e2e/studio.spec.ts",
  ]) {
    expect((await fetch(base + path)).status).toBe(404);
  }
  console.log(
    "artifact boundary: PASS only index.html + assets; docs/ZIP/src/tests return 404",
  );
} finally {
  await browser.close();
}
