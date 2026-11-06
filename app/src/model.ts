import { z } from "zod";
const num = z.number().finite();
const id = z.string().min(1).max(100);
const text = z.string().max(10000);
export const pointSchema = z.tuple([num, num]);
export type Point = z.infer<typeof pointSchema>;
export const measureSchema = z
  .object({
    value: num,
    unit: z.enum(["px", "ratio"]),
    base: z.enum(["width", "height"]).default("width"),
  })
  .strict();
export const frameSchema = z
  .object({
    x: measureSchema,
    y: measureSchema,
    width: measureSchema,
    height: measureSchema,
    anchor: z.enum(["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"]),
    relativeTo: z.string().max(100),
  })
  .strict();
export const regionSchema = z
  .object({
    id,
    type: z.enum(["keep", "avoid"]),
    polygon: z.array(pointSchema).min(3).max(64),
    priority: num.min(0).max(100),
    target: pointSchema,
    exit: z.enum(["left", "right", "top", "bottom"]),
    anchor: z
      .enum(["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"])
      .default("cc"),
  })
  .strict();
export type Region = z.infer<typeof regionSchema>;
export const placementSchema = z
  .object({
    x: num,
    y: num,
    scale: num.positive().max(100),
    rotation: num,
    pivot: pointSchema,
  })
  .strict();
export type Placement = z.infer<typeof placementSchema>;
export const effectSchema = z
  .object({
    id,
    type: z.enum([
      "blur",
      "variableBlur",
      "noise",
      "brightness",
      "saturation",
      "tint",
      "ink",
    ]),
    enabled: z.boolean(),
    amount: num.min(0).max(100),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    reverse: z.boolean(),
    feather: num.min(0).max(1),
    curve: num.positive().max(10),
    shape: z.enum(["rect", "ellipse", "rounded"]),
    region: z.tuple([num, num, num, num]),
    seed: num.int(),
  })
  .strict();
export type Effect = z.infer<typeof effectSchema>;
const stopSchema = z
  .object({
    offset: num.min(0).max(1),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    alpha: num.min(0).max(1),
  })
  .strict();
export const lineSchema = z
  .object({
    id,
    angle: num,
    position: pointSchema,
    enabled: z.boolean(),
    decorative: z.boolean(),
    color: text,
    width: num.min(0).max(100),
    opacity: num.min(0).max(1),
  })
  .strict();
export type SplitLine = z.infer<typeof lineSchema>;
export const slotSchema = z
  .object({
    id,
    assetId: z.string().max(100),
    placement: placementSchema,
    reference: placementSchema,
    fit: z.enum(["cover", "contain"]),
    effects: z.array(effectSchema).max(20),
    regionOverrides: z.array(regionSchema).max(30).optional(),
  })
  .strict();
export type Slot = z.infer<typeof slotSchema>;
export const nodeSchema = z
  .object({
    id,
    name: text,
    type: z.enum([
      "shape",
      "text",
      "label",
      "image",
      "split",
      "particles",
      "gradient",
      "adjustment",
      "group",
      "icon",
    ]),
    parentId: z.string().max(100),
    visible: z.boolean(),
    locked: z.boolean(),
    opacity: num.min(0).max(1),
    blend: z.enum([
      "normal",
      "multiply",
      "screen",
      "overlay",
      "soft-light",
      "hard-light",
      "darken",
      "lighten",
      "add",
    ]),
    frame: frameSchema,
    rotation: num,
    fill: text,
    radii: z.tuple([num, num, num, num]),
    mask: z.enum(["none", "rect", "ellipse", "rounded"]),
    effects: z.array(effectSchema).max(20),
    text: text,
    fontFamily: text,
    fontAssetId: z.string().max(100),
    fontSize: num.positive().max(2000),
    fontUnit: z.enum(["px", "ratio"]),
    fontWeight: num.min(100).max(900),
    letterSpacing: num,
    lineHeight: num.positive().max(10),
    align: z.enum(["left", "center", "right"]),
    textBackground: text,
    charBackground: text,
    stroke: text,
    strokeWidth: num.min(0).max(100),
    shadow: num.min(0).max(100),
    padding: num.min(0).max(200),
    slots: z.array(slotSchema).max(32),
    lines: z.array(lineSchema).max(6),
    cellOwners: z.record(z.string(), z.string()),
    gradient: z
      .object({
        kind: z.enum(["linear", "radial"]),
        angle: num,
        reverse: z.boolean(),
        stops: z.array(stopSchema).min(2).max(12),
      })
      .strict(),
    particle: z
      .object({
        kind: z.enum(["light", "snow", "petal", "dust", "spark", "polygon"]),
        seed: num.int(),
        count: num.int().min(0).max(1000),
        speed: num,
        life: num.positive(),
        gravity: num,
        sway: num,
        size: num.positive(),
        time: num.min(0),
        color: text,
      })
      .strict(),
    adjustmentTarget: z.string().max(100),
    icon: z.enum([
      "star",
      "heart",
      "flower",
      "moon",
      "sparkles",
      "diamond",
      "circle",
      "check",
    ]),
    decoration: z.enum(["none", "paper", "torn", "plastic", "tape"]),
    composition: z
      .object({
        mode: z.enum(["fixed", "bounded"]),
        maxDelta: num.min(0).max(180),
        minScale: num.positive(),
        maxScale: num.positive(),
        weights: z
          .object({
            keep: num,
            anchor: num,
            size: num,
            avoid: num,
            exit: num,
            scale: num,
            rotation: num,
            blank: num,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type Layer = z.infer<typeof nodeSchema>;
export type Frame = z.infer<typeof frameSchema>;
export const patchSchema = z
  .object({
    op: z.enum(["add", "replace", "remove", "move", "hide", "show"]),
    targetId: id,
    path: z.string().max(100).optional(),
    value: z.unknown().optional(),
    baseRevision: num.int().optional(),
  })
  .strict();
export type Patch = z.infer<typeof patchSchema>;
const base = {
  id,
  schemaVersion: z.literal(1),
  revision: num.int().nonnegative(),
  createdAt: text,
  updatedAt: text,
};
export const templateSchema = z
  .object({
    ...base,
    name: text,
    width: num.positive(),
    height: num.positive(),
    layers: z.array(nodeSchema).max(200),
  })
  .strict();
export type Template = z.infer<typeof templateSchema>;
export const variantSchema = z
  .object({
    ...base,
    name: text,
    templateId: id,
    templateRevision: num.int(),
    patches: z.array(patchSchema).max(2000),
  })
  .strict();
export type Variant = z.infer<typeof variantSchema>;
export const projectSchema = z
  .object({
    ...base,
    name: text,
    templateSnapshot: templateSchema,
    variantSnapshot: variantSchema.optional(),
    variables: z.record(z.string().max(100), text),
    patches: z.array(patchSchema).max(4000),
    profilePatches: z.record(
      z.string().max(100),
      z.array(patchSchema).max(4000),
    ),
    profileIds: z.array(id).max(30),
    series: text,
    serial: num.int().nonnegative(),
    serialConfirmed: z.boolean(),
    timezone: text,
    date: text,
    filename: text,
  })
  .strict();
export type Project = z.infer<typeof projectSchema>;
export const profileSchema = z
  .object({
    ...base,
    name: text,
    service: text,
    purpose: text,
    width: num.int().positive().max(4096),
    height: num.int().positive().max(4096),
    safe: num.min(0).max(0.45),
    overlays: z.array(z.array(pointSchema).min(3).max(64)).max(20),
    sourceURL: text,
    checkedAt: text,
    confidence: z.enum([
      "provisional",
      "verified_official",
      "verified_observed",
    ]),
    transparent: z.boolean(),
    background: text,
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export const assetSchema = z
  .object({
    ...base,
    name: text,
    kind: z.enum(["image", "font", "svg"]),
    mime: text,
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    blobKey: id,
    width: num.nonnegative(),
    height: num.nonnegative(),
    regions: z.array(regionSchema).max(30),
    license: text,
    redistributable: z.boolean(),
    library: z.boolean(),
    previousId: z.string().max(100),
  })
  .strict();
export type Asset = z.infer<typeof assetSchema>;
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: num.int().nonnegative(),
    templates: z.array(templateSchema).max(100),
    variants: z.array(variantSchema).max(500),
    projects: z.array(projectSchema).max(500),
    profiles: z.array(profileSchema).max(100),
    assets: z.array(assetSchema).max(1000),
    labels: z
      .array(
        z
          .object({
            id,
            name: text,
            hidden: z.boolean(),
            color: text,
            icon: nodeSchema.shape.icon,
          })
          .strict(),
      )
      .max(100),
    presets: z
      .array(z.object({ id, name: text, node: nodeSchema }).strict())
      .max(100),
    series: z.record(z.string(), num.int().nonnegative()),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export const uid = () => crypto.randomUUID();
export const clone = <T>(x: T): T => structuredClone(x);
export const record = () => ({
  id: uid(),
  schemaVersion: 1 as const,
  revision: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
export const m = (
  value: number,
  unit: "px" | "ratio" = "ratio",
  base: "width" | "height" = "width",
) => ({ value, unit, base });
export const placement = (): Placement => ({
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  pivot: [0.5, 0.5],
});
export function layer(type: Layer["type"], name: string): Layer {
  return {
    id: uid(),
    type,
    name,
    parentId: "",
    visible: true,
    locked: false,
    opacity: 1,
    blend: "normal",
    frame: {
      x: m(0.1),
      y: m(0.1, "ratio", "height"),
      width: m(0.8),
      height: m(0.3, "ratio", "height"),
      anchor: "tl",
      relativeTo: "canvas",
    },
    rotation: 0,
    fill: "#f5edda",
    radii: [16, 16, 16, 16],
    mask: "none",
    effects: [],
    text: "{{title}}",
    fontFamily: "sans-serif",
    fontAssetId: "",
    fontSize: 64,
    fontUnit: "px",
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.3,
    align: "left",
    textBackground: "",
    charBackground: "",
    stroke: "#142524",
    strokeWidth: 0,
    shadow: 0,
    padding: 12,
    slots: [],
    lines: [],
    cellOwners: {},
    gradient: {
      kind: "linear",
      angle: 30,
      reverse: false,
      stops: [
        { offset: 0, color: "#153b36", alpha: 1 },
        { offset: 1, color: "#b8c4ac", alpha: 1 },
      ],
    },
    particle: {
      kind: "light",
      seed: 42,
      count: 50,
      speed: 20,
      life: 10,
      gravity: 0,
      sway: 10,
      size: 5,
      time: 0,
      color: "#f6d68c",
    },
    adjustmentTarget: "",
    icon: "star",
    decoration: "none",
    composition: {
      mode: "fixed",
      maxDelta: 15,
      minScale: 0.5,
      maxScale: 3,
      weights: {
        keep: 10,
        anchor: 3,
        size: 1,
        avoid: 8,
        exit: 2,
        scale: 0.5,
        rotation: 0.2,
        blank: 5,
      },
    },
  };
}
export function effect(type: Effect["type"]): Effect {
  return {
    id: uid(),
    type,
    enabled: true,
    amount: type === "brightness" || type === "saturation" ? 100 : 8,
    color: "#e5af78",
    reverse: false,
    feather: 0.4,
    curve: 1,
    shape: "ellipse",
    region: [0, 0, 1, 1],
    seed: 42,
  };
}
export function newProject(t: Template, v?: Variant): Project {
  if (v && (v.templateId !== t.id || v.templateRevision !== t.revision))
    throw Error("ERR_VARIANT_REVISION");
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  return {
    ...record(),
    name: "新しいバナー",
    templateSnapshot: clone(t),
    ...(v ? { variantSnapshot: clone(v) } : {}),
    variables: {
      title: "物語のつづきを、ここから。",
      subtitle: "制作ノート / 新しい作品",
      category: "作品",
      visibility: "全体公開",
    },
    patches: [],
    profilePatches: {},
    profileIds: ["wide", "square", "portrait"],
    series: "default",
    serial: 1,
    serialConfirmed: false,
    timezone: "Asia/Tokyo",
    date,
    filename: "{{title}}_{{service}}_{{serial:03}}",
  };
}
export function initialWorkspace(): Workspace {
  const bg = layer("gradient", "背景");
  bg.frame = {
    ...bg.frame,
    x: m(0),
    y: m(0, "ratio", "height"),
    width: m(1),
    height: m(1, "ratio", "height"),
  };
  const title = layer("text", "タイトル");
  title.frame.y = m(0.52, "ratio", "height");
  title.frame.height = m(0.25, "ratio", "height");
  title.fontSize = 0.055;
  title.fontUnit = "ratio";
  const subtitle = layer("text", "サブタイトル");
  subtitle.text = "{{subtitle}}";
  subtitle.fontSize = 0.023;
  subtitle.fontUnit = "ratio";
  subtitle.frame.y = m(0.8, "ratio", "height");
  subtitle.frame.height = m(0.12, "ratio", "height");
  const label = layer("label", "公開ラベル");
  label.text = "{{visibility}}";
  label.fill = "#183c34";
  label.fontSize = 26;
  label.fontWeight = 500;
  label.frame.width = m(0.25);
  label.frame.height = m(0.11, "ratio", "height");
  label.textBackground = "#f0c980";
  const particles = layer("particles", "光の粒");
  particles.frame = clone(bg.frame);
  particles.opacity = 0.6;
  const t: Template = {
    ...record(),
    name: "余白のある制作ノート",
    width: 1200,
    height: 630,
    layers: [bg, particles, title, subtitle, label],
  };
  const profiles: Profile[] = [
    ["wide", "横長", 1200, 630],
    ["square", "正方形", 1080, 1080],
    ["portrait", "縦長", 1080, 1350],
  ].map(([id, name, width, height]) => ({
    ...record(),
    id: String(id),
    name: String(name),
    width: Number(width),
    height: Number(height),
    service: "カスタム",
    purpose: "検証用",
    safe: 0.06,
    overlays: [],
    sourceURL: "",
    checkedAt: "",
    confidence: "provisional",
    transparent: false,
    background: "#142524",
  }));
  const v: Variant = {
    ...record(),
    name: "夜のアトリエ",
    templateId: t.id,
    templateRevision: 0,
    patches: [
      {
        op: "replace",
        targetId: bg.id,
        path: "gradient",
        value: {
          ...bg.gradient,
          stops: [
            { offset: 0, color: "#22243f", alpha: 1 },
            { offset: 1, color: "#654c72", alpha: 1 },
          ],
        },
      },
    ],
  };
  return {
    schemaVersion: 1,
    revision: 0,
    templates: [t],
    variants: [v],
    projects: [newProject(t)],
    profiles,
    assets: [],
    presets: [],
    labels: [
      "全体公開",
      "成人向け",
      "支援者限定",
      "先行公開",
      "お知らせ",
      "作品",
      "更新情報",
    ].map((name) => ({
      id: uid(),
      name,
      hidden: false,
      color: "#f0c980",
      icon: "star",
    })),
    series: { default: 1 },
  };
}
