import {
  clone,
  m,
  type Layer,
  type Profile,
  type Patch,
  type Workspace,
} from "./model";
import { workspaceSchema } from "./model";
export function arrangeImages(
  layers: Layer[],
  profile: Profile,
  mode: "horizontal" | "vertical" | "grid",
  gap = 16,
): Patch[] {
  const images = layers.filter(
    (n) => ["image", "split"].includes(n.type) && !n.locked,
  );
  if (!images.length) return [];
  const cols =
      mode === "horizontal"
        ? images.length
        : mode === "vertical"
          ? 1
          : Math.ceil(Math.sqrt(images.length)),
    rows = Math.ceil(images.length / cols);
  const width = (profile.width - gap * (cols + 1)) / cols,
    height = (profile.height - gap * (rows + 1)) / rows;
  if (width <= 0 || height <= 0) throw Error("ERR_LAYOUT_SIZE");
  return images.map((n, i) => ({
    op: "replace",
    targetId: n.id,
    path: "frame",
    value: {
      x: m(gap + (i % cols) * (width + gap), "px"),
      y: m(gap + Math.floor(i / cols) * (height + gap), "px", "height"),
      width: m(width, "px"),
      height: m(height, "px", "height"),
      anchor: "tl",
      relativeTo: "canvas",
    },
  }));
}
// Schema 0 is the internal prototype shape: identical records without revision counters.
export function migrateWorkspace(input: unknown): Workspace {
  if (!input || typeof input !== "object") throw Error("ERR_SCHEMA");
  const data = clone(input) as Record<string, unknown>;
  if (data.schemaVersion === 1) return workspaceSchema.parse(data);
  if (data.schemaVersion !== 0) throw Error("ERR_SCHEMA_VERSION");
  function visit(v: unknown): void {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === "object") {
      const r = v as Record<string, unknown>;
      if ("schemaVersion" in r) r.schemaVersion = 1;
      if ("schemaVersion" in r || ("id" in r && "createdAt" in r))
        r.revision ??= 0;
      Object.values(r).forEach(visit);
    }
  }
  visit(data);
  return workspaceSchema.parse(data);
}
