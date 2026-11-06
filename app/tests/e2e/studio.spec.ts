import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function enter(page: Page) {
  await page.goto("./");
  await page.getByLabel("合言葉", { exact: true }).fill("banner-demo");
  await page.getByRole("button", { name: "制作室を開く" }).click();
  await expect(page.getByLabel("タイトル", { exact: true })).toBeVisible();
  await expect(page.getByText("描画中…")).toHaveCount(0);
}
test("gate wrong, correct, session reload and logout", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("合言葉", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "制作室を開く" }).click();
  await expect(page.getByRole("alert")).toContainText("合言葉が違います");
  await page.getByLabel("合言葉", { exact: true }).fill("banner-demo");
  await page.getByRole("button", { name: "制作室を開く" }).click();
  await expect(page.getByLabel("タイトル", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("タイトル", { exact: true })).toBeVisible();
  await page.getByLabel("ログアウト").click();
  await expect(page.getByLabel("合言葉", { exact: true })).toBeVisible();
});
test("S1 Template → Variant → Project → 3 PNG and persistence", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await page.getByRole("button", { name: "プロジェクト", exact: true }).click();
  page.once("dialog", (d) => d.accept("試験テンプレート"));
  await page
    .getByRole("button", { name: "＋ 新規テンプレート", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "試験テンプレート", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "プロジェクト", exact: true }).click();
  const card = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "試験テンプレート", exact: true }),
    });
  page.once("dialog", (d) => d.accept("テスト配色"));
  await card
    .getByRole("button", { name: "バリエーションを追加", exact: true })
    .click();
  await page.getByRole("button", { name: "プロジェクト", exact: true }).click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "試験テンプレート", exact: true }),
    })
    .getByRole("button", { name: "このテンプレートで投稿", exact: true })
    .click();
  await page
    .getByLabel("タイトル", { exact: true })
    .fill("テスト制作日誌 が 👨‍👩‍👧‍👦");
  await page
    .getByLabel("投稿のバリエーション", { exact: true })
    .selectOption({ label: "テスト配色" });
  await expect(page.getByText("描画中…")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("保存済み");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("保存済み");
  await page.getByRole("button", { name: "プロジェクト", exact: true }).click();
  const project = page.locator("article").filter({ hasText: "テスト制作日誌" });
  await project.getByRole("button", { name: "開く", exact: true }).click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(
    "テスト制作日誌 が 👨‍👩‍👧‍👦",
  );
  await page.getByRole("button", { name: "書き出し", exact: true }).click();
  await page
    .getByRole("button", { name: "一括PNGを生成（試し出力）", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("3件のPNG");
  const links = page.locator("a[download]");
  await expect(links).toHaveCount(3);
  const expected = [
    [1200, 630],
    [1080, 1080],
    [1080, 1350],
  ];
  for (let i = 0; i < 3; i++) {
    const event = page.waitForEvent("download");
    await links.nth(i).click();
    const d = await event;
    const path = info.outputPath(`profile-${i}.png`);
    await d.saveAs(path);
    const bytes = await readFile(path);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(
      expected[i],
    );
  }
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath("export.png"),
    fullPage: true,
  });
});
test("backup and anonymous diagnostics, safe SVG import, no outgoing content", async ({
  page,
}) => {
  const remote: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      remote.push(r.url());
  });
  await enter(page);
  await page
    .getByLabel("タイトル", { exact: true })
    .fill("NEVER_SEND_PRIVATE_TEXT");
  await page
    .getByLabel("画像を取り込む", { exact: true })
    .setInputFiles({
      name: "sample.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><script>alert(1)</script><rect width="200" height="100" fill="red"/></svg>',
      ),
    });
  await expect(page.getByRole("alert")).toContainText("1点");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  let event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップZIPを保存", exact: true })
    .click();
  const backup = await event;
  const path = await backup.path();
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("バックアップを取り込む", { exact: true })
    .setInputFiles(path!);
  await expect(page.getByRole("alert")).toContainText("別IDで取り込みました");
  await page.getByRole("button", { name: "診断", exact: true }).click();
  event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "素材なし診断ZIPを保存", exact: true })
    .click();
  const diagnostic = await event;
  await page
    .getByLabel("診断ZIPを読み込む", { exact: true })
    .setInputFiles((await diagnostic.path())!);
  await expect(
    page.getByText("隔離診断セッション：元データへ保存しません。"),
  ).toBeVisible();
  expect(remote).toEqual([]);
});
test("renderer integration: split FX, group isolation, deterministic PNG, missing font", async ({
  page,
}, info) => {
  test.skip(
    info.project.name.includes("mobile"),
    "same WebGL engine; run integration once",
  );
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await enter(page);
  const result = await page.evaluate(async () => {
    const root = "/banner-studio/src/";
    const { StudioRenderer } = await import(root + "renderer.ts");
    const { initialWorkspace, layer, m, placement, effect } = await import(
      root + "model.ts"
    );
    const w = initialWorkspace(),
      p = w.projects[0],
      profile = {
        ...w.profiles[0],
        width: 240,
        height: 120,
        transparent: true,
      };
    const engine = new StudioRenderer();
    await engine.init(document.createElement("canvas"));
    const make = (name: string, color: string, x: number) => {
      const n = layer("shape", name);
      n.fill = color;
      n.radii = [0, 0, 0, 0];
      n.frame = {
        x: m(x, "px"),
        y: m(0, "px"),
        width: m(120, "px"),
        height: m(120, "px"),
        anchor: "tl",
        relativeTo: "canvas",
      };
      return n;
    };
    const red = make("red", "#ff0000", 0),
      blue = make("blue", "#0000ff", 120);
    const group = layer("group", "group");
    group.frame = {
      x: m(0),
      y: m(0),
      width: m(1),
      height: m(1, "ratio", "height"),
      anchor: "tl",
      relativeTo: "canvas",
    };
    red.parentId = group.id;
    const adjust = layer("adjustment", "adjust");
    adjust.parentId = group.id;
    adjust.effects = [{ ...effect("brightness"), amount: 10 }];
    p.templateSnapshot.layers = [group, red, adjust, blue];
    const pixels = async () => {
      await engine.render(p, profile, [], async () => undefined);
      const b = await engine.png(),
        bitmap = await createImageBitmap(b),
        c = document.createElement("canvas");
      c.width = 240;
      c.height = 120;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return {
        data: Array.from(ctx.getImageData(0, 0, 240, 120).data),
        bytes: Array.from(new Uint8Array(await b.arrayBuffer())),
      };
    };
    const a = await pixels(),
      b = await pixels();
    const bluePixel = a.data.slice(
      (60 * 240 + 180) * 4,
      (60 * 240 + 180) * 4 + 4,
    );
    const redPixel = a.data.slice((60 * 240 + 60) * 4, (60 * 240 + 60) * 4 + 4);
    const text = layer("text", "font");
    text.fontAssetId = "missing";
    p.templateSnapshot.layers = [text];
    let missing = "";
    try {
      await engine.render(p, profile, [], async () => undefined);
    } catch (e) {
      missing = (e as Error).message;
    }
    const split = layer("split", "split");
    split.frame = group.frame;
    split.slots = [
      {
        id: "slot1",
        assetId: "a",
        placement: placement(),
        reference: placement(),
        fit: "cover",
        effects: [effect("blur")],
      },
      {
        id: "slot2",
        assetId: "b",
        placement: placement(),
        reference: placement(),
        fit: "cover",
        effects: [],
      },
    ];
    split.lines = [
      {
        id: "line",
        angle: 60,
        position: [0.5, 0.5],
        enabled: true,
        decorative: true,
        color: "#ffffff",
        width: 8,
        opacity: 1,
      },
    ];
    p.templateSnapshot.layers = [split];
    const blobs = new Map([
      [
        "a",
        new Blob(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
          ],
          { type: "image/svg+xml" },
        ),
      ],
      [
        "b",
        new Blob(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>',
          ],
          { type: "image/svg+xml" },
        ),
      ],
    ]);
    const assets = [
      { id: "a", blobKey: "a" },
      { id: "b", blobKey: "b" },
    ];
    await engine.render(p, profile, assets, async (id: string) =>
      blobs.get(id),
    );
    const sharp = Array.from(
      new Uint8Array(await (await engine.png()).arrayBuffer()),
    );
    split.effects = [effect("blur")];
    await engine.render(p, profile, assets, async (id: string) =>
      blobs.get(id),
    );
    const blurred = Array.from(
      new Uint8Array(await (await engine.png()).arrayBuffer()),
    );
    split.effects = [effect("variableBlur")];
    await engine.render(p, profile, assets, async (id: string) =>
      blobs.get(id),
    );
    const variableSize = (await engine.png()).size;
    engine.destroy();
    return {
      same: JSON.stringify(a.bytes) === JSON.stringify(b.bytes),
      bluePixel,
      redPixel,
      missing,
      splitChanged: JSON.stringify(sharp) !== JSON.stringify(blurred),
      variableSize,
    };
  });
  expect(result.same).toBe(true);
  expect(result.bluePixel).toEqual([0, 0, 255, 255]);
  expect(result.redPixel[0]).toBeLessThan(40);
  expect(result.missing).toBe("ERR_FONT_MISSING");
  expect(result.splitChanged).toBe(true);
  expect(result.variableSize).toBeGreaterThan(100);
  expect(consoleErrors).toEqual([]);
});
test("mobile layout and diagnostics reachable, canvas screenshot", async ({
  page,
}, info) => {
  await enter(page);
  await page.screenshot({
    path: info.outputPath("editor.png"),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "診断", exact: true }).click();
  await page
    .getByRole("button", { name: "自己診断（ダミーデータ）", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("自己診断");
  await expect(page.getByRole("alert")).toContainText("成功");
});
