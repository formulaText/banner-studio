import { describe, it, expect } from "vitest";
import {
  initialWorkspace,
  clone,
  layer,
  m,
  uid,
  placement,
  type Region,
} from "../src/model";
import {
  applyPatches,
  resolve,
  validateWorkspace,
  graphemes,
  bind,
  filename,
  History,
} from "../src/document";
import {
  area,
  intersect,
  rect,
  splitCells,
  optimize,
  particles,
  polygonValid,
} from "../src/geometry";
import {
  StudioDB,
  createBackup,
  readBackup,
  mergeWorkspace,
  safeUnzip,
  sha256,
} from "../src/storage";
import { redactedState, Diagnostics } from "../src/diagnostics";
import { zipSync, strToU8 } from "fflate";
describe("document contracts", () => {
  it("RV-TPL-01 precedence and immutable source", () => {
    const w = initialWorkspace(),
      p = w.projects[0],
      id = p.templateSnapshot.layers[2].id,
      original = clone(w.templates[0]);
    p.variantSnapshot = {
      ...w.variants[0],
      patches: [
        { op: "replace", targetId: id, path: "fill", value: "#ff0000" },
      ],
    };
    p.patches = [
      { op: "replace", targetId: id, path: "fill", value: "#00ff00" },
    ];
    p.profilePatches.wide = [
      { op: "replace", targetId: id, path: "fill", value: "#0000ff" },
    ];
    const r = resolve(p, w.profiles[0]);
    expect(r.layers.find((l) => l.id === id)?.fill).toBe("#0000ff");
    expect(r.origins[id].fill).toBe("profile");
    expect(w.templates[0]).toEqual(original);
    expect(
      resolve(p, w.profiles[1]).layers.find((l) => l.id === id)?.fill,
    ).toBe("#00ff00");
  });
  it("RV-TPL-02 snapshot remains unchanged", () => {
    const w = initialWorkspace();
    w.templates[0].layers[0].fill = "#000000";
    expect(w.projects[0].templateSnapshot.layers[0].fill).not.toBe("#000000");
  });
  it("missing patches fail atomically", () => {
    const n = layer("shape", "a"),
      before = clone(n);
    expect(() =>
      applyPatches(
        [n],
        [
          { op: "replace", targetId: n.id, path: "fill", value: "#000000" },
          { op: "replace", targetId: "missing", path: "fill", value: "#fff" },
        ],
      ),
    ).toThrow();
    expect(n).toEqual(before);
    expect(() =>
      applyPatches(
        [n],
        [{ op: "replace", targetId: n.id, path: "__proto__", value: {} }],
      ),
    ).toThrow();
  });
  it("layout ratio, anchor, safe and cycles", () => {
    const w = initialWorkspace(),
      p = w.projects[0],
      n = layer("shape", "anchor");
    n.frame = {
      x: m(0),
      y: m(0),
      width: m(0.2),
      height: m(0.2, "ratio", "height"),
      anchor: "br",
      relativeTo: "safe",
    };
    p.templateSnapshot.layers = [n];
    const b = resolve(p, w.profiles[0]).boxes[n.id];
    expect(b.x + b.width).toBeCloseTo(1200 * 0.94);
    n.frame.relativeTo = n.id;
    expect(() => resolve(p, w.profiles[0])).toThrow("ERR_LAYOUT_CYCLE");
  });
  it("Unicode graphemes, date and filename", () => {
    expect(graphemes("か\u3099👨‍👩‍👧‍👦")).toHaveLength(2);
    const p = initialWorkspace().projects[0];
    p.date = "2026-11-06";
    expect(bind("{{serial:03}} {{date:YYYY/MM/DD}}", p)).toBe("001 2026/11/06");
    const used = new Set<string>();
    expect(filename("x/y", used)).toBe("x_y.png");
    expect(filename("x/y", used)).toBe("x_y_2.png");
  });
  it("history handles undo redo", () => {
    const h = new History({ x: 1 });
    h.commit({ x: 2 });
    expect(h.undo()).toEqual({ x: 1 });
    expect(h.redo()).toEqual({ x: 2 });
  });
  it("rejects future schema and invalid groups", () => {
    const w = initialWorkspace();
    expect(() => validateWorkspace({ ...w, schemaVersion: 99 })).toThrow();
    w.templates[0].layers[0].parentId = "missing";
    expect(() => validateWorkspace(w)).toThrow();
  });
});
describe("geometry contracts", () => {
  const region: Region = {
    id: "keep",
    type: "keep",
    polygon: [
      [0.6, 0.1],
      [0.9, 0.1],
      [0.9, 0.3],
      [0.6, 0.3],
    ],
    priority: 1,
    target: [0.8, 0.2],
    exit: "bottom",
    anchor: "tr",
  };
  it("RV-CMP-05 true polygon area", () =>
    expect(
      area(
        intersect(rect(100, 100), [
          [0, 0],
          [100, 0],
          [0, 100],
        ]),
      ),
    ).toBe(5000));
  it("split transparent boundary and crossing lines preserve area", () => {
    const line = {
      id: "a",
      angle: 60,
      position: [0.5, 0.5] as [number, number],
      enabled: true,
      decorative: false,
      color: "#ffffff",
      width: 2,
      opacity: 1,
    };
    const cells = splitCells(100, 100, [line, { ...line, id: "b", angle: 0 }]);
    expect(cells.length).toBe(4);
    expect(cells.reduce((s, c) => s + area(c.polygon), 0)).toBeCloseTo(10000);
    expect(splitCells(100, 100, [{ ...line, decorative: true }])).toEqual(
      splitCells(100, 100, [line]),
    );
  });
  it("RV-CMP-01/02/04/06 fixed, bounded and deterministic", () => {
    const s = { ...placement(), rotation: -20 },
      cfg = layer("image", "i").composition;
    const args = [
      s,
      1200,
      630,
      600,
      600,
      rect(600, 600),
      [region] as Region[],
    ] as const;
    const fixed = optimize(...args, cfg);
    expect(fixed.every((c) => c.placement.rotation === -20)).toBe(true);
    const bounded = optimize(...args, { ...cfg, mode: "bounded" });
    expect(
      bounded.every(
        (c) => c.placement.rotation >= -35 && c.placement.rotation <= -5,
      ),
    ).toBe(true);
    expect(optimize(...args, cfg)).toEqual(fixed);
    expect(optimize(...args, { ...cfg, mode: "bounded", maxDelta: 0 })).toEqual(
      fixed,
    );
  });
  it("RV-CMP-03 conflicts and invalid constraints", () => {
    const cfg = layer("image", "i").composition;
    const result = optimize(
      placement(),
      100,
      100,
      100,
      100,
      rect(100, 100),
      [region, { ...region, id: "avoid", type: "avoid" }],
      cfg,
    );
    expect(result[0].conflict).toBe(true);
    expect(() =>
      optimize(placement(), 100, 100, 100, 100, rect(100, 100), [], {
        ...cfg,
        minScale: 5,
        maxScale: 1,
      }),
    ).toThrow();
    expect(
      polygonValid([
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0],
      ]),
    ).toBe(false);
  });
  it("particle time and seed repeat", () => {
    const p = layer("particles", "p").particle;
    expect(particles(p, 100, 100)).toEqual(particles(p, 100, 100));
    expect(particles({ ...p, time: 1 }, 100, 100)).not.toEqual(
      particles(p, 100, 100),
    );
  });
});
describe("persistence and safety", () => {
  it("atomic IndexedDB write and concurrent generation guard", async () => {
    const db = new StudioDB("test-" + uid()),
      w = initialWorkspace();
    const g = await db.save(w, 0);
    expect(g).toBe(1);
    await expect(db.save(w, 0)).rejects.toThrow("ERR_STORAGE_CONFLICT");
    expect((await db.load())?.value).toEqual(w);
    db.close();
  });
  it("backup roundtrip, checksums and cloned import", async () => {
    const w = initialWorkspace();
    const zip = await createBackup(w, async () => undefined, false);
    const parsed = await readBackup(zip);
    expect(parsed.workspace).toEqual(w);
    const merged = mergeWorkspace(w, parsed.workspace, parsed.blobs);
    expect(merged.workspace.projects).toHaveLength(2);
    expect(merged.workspace.projects[0].id).not.toBe(
      merged.workspace.projects[1].id,
    );
    const bad = new Blob([
      new Uint8Array(
        zipSync({
          "manifest.json": strToU8(
            JSON.stringify({
              format: "banner-studio-backup",
              formatVersion: 1,
              entries: [
                { path: "data/workspace.json", size: 2, sha256: "wrong" },
              ],
            }),
          ),
          "data/workspace.json": strToU8("{}"),
        }),
      ).buffer,
    ]);
    await expect(readBackup(bad)).rejects.toThrow("ERR_BACKUP_CHECKSUM");
    expect(await sha256(strToU8("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("RV-SEC-03 path traversal rejected before inflate", () => {
    expect(() => safeUnzip(zipSync({ "../evil": strToU8("evil") }))).toThrow(
      "ERR_ZIP_PATH_OR_SIZE",
    );
  });
  it("RV-SEC-01 diagnostics contain no authored strings", () => {
    const w = initialWorkspace(),
      p = w.projects[0];
    p.variables.title = "TOP_SECRET";
    p.name = "PRIVATE_NAME";
    p.templateSnapshot.layers[2].text = "SECRET_TEXT";
    const s = JSON.stringify(redactedState(p, w.profiles[0]));
    expect(s).not.toMatch(/TOP_SECRET|PRIVATE_NAME|SECRET_TEXT/);
  });
  it("ring buffer off and limits", () => {
    const d = new Diagnostics();
    d.record("UI", "EDIT");
    expect(d.events).toHaveLength(0);
    d.enabled = true;
    for (let i = 0; i < 400; i++) d.record("UI", "EDIT");
    expect(d.events).toHaveLength(300);
  });
});
