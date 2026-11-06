import {
  clone,
  nodeSchema,
  workspaceSchema,
  type Layer,
  type Patch,
  type Project,
  type Profile,
  type Workspace,
  type Frame,
} from "./model";
import { polygonValid } from "./geometry";
export function applyPatches(
  input: Layer[],
  patches: Patch[],
  source = "project",
  origins: Record<string, Record<string, string>> = {},
): Layer[] {
  let layers = clone(input);
  for (const p of patches) {
    const i = layers.findIndex((n) => n.id === p.targetId);
    if (p.op === "add") {
      const n = nodeSchema.parse(p.value);
      if (i >= 0 || n.id !== p.targetId) throw Error("ERR_PATCH_DUPLICATE");
      layers.push(n);
      origins[n.id] = { node: source };
      continue;
    }
    if (i < 0) throw Error("ERR_PATCH_MISSING");
    const n = layers[i];
    if (p.op === "remove") {
      const removed = new Set([p.targetId]);
      for (let pass = 0; pass < layers.length; pass++)
        for (const child of layers)
          if (removed.has(child.parentId)) removed.add(child.id);
      layers = layers.filter((l) => !removed.has(l.id));
      continue;
    }
    if (p.op === "move") {
      const at = Number(p.value);
      if (!Number.isInteger(at) || at < 0 || at >= layers.length)
        throw Error("ERR_PATCH_INDEX");
      layers.splice(i, 1);
      layers.splice(at, 0, n);
      continue;
    }
    if (p.op === "hide" || p.op === "show") {
      n.visible = p.op === "show";
      continue;
    }
    if (
      !p.path ||
      !Object.hasOwn(nodeSchema.shape, p.path) ||
      p.path === "id" ||
      p.path === "type"
    )
      throw Error("ERR_PATCH_PATH");
    layers[i] = nodeSchema.parse({ ...n, [p.path]: clone(p.value) });
    origins[n.id] = { ...origins[n.id], [p.path]: source };
  }
  return layers;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Resolved {
  layers: Layer[];
  boxes: Record<string, Box>;
  origins: Record<string, Record<string, string>>;
  warnings: string[];
  profile: Profile;
}
export function resolve(project: Project, profile: Profile): Resolved {
  const origins: Resolved["origins"] = {};
  let layers = applyPatches(
    project.templateSnapshot.layers,
    project.variantSnapshot?.patches ?? [],
    "variant",
    origins,
  );
  layers = applyPatches(layers, project.patches, "project", origins);
  const boxes: Record<string, Box> = {},
    visiting = new Set<string>(),
    warnings: string[] = [];
  const canvas = { x: 0, y: 0, width: profile.width, height: profile.height };
  const safe = {
    x: profile.width * profile.safe,
    y: profile.height * profile.safe,
    width: profile.width * (1 - 2 * profile.safe),
    height: profile.height * (1 - 2 * profile.safe),
  };
  function locate(n: Layer): Box {
    if (boxes[n.id]) return boxes[n.id];
    if (visiting.has(n.id)) throw Error("ERR_LAYOUT_CYCLE");
    visiting.add(n.id);
    let ref = canvas;
    const rid =
      n.frame.relativeTo === "parent" ? n.parentId : n.frame.relativeTo;
    if (rid === "safe") ref = safe;
    else if (rid && rid !== "canvas") {
      const parent = layers.find((l) => l.id === rid);
      if (!parent) throw Error("ERR_LAYOUT_REFERENCE");
      ref = locate(parent);
    }
    const value = (v: Frame["x"]) =>
      v.unit === "px"
        ? v.value
        : v.value * (v.base === "width" ? ref.width : ref.height);
    const width = value(n.frame.width),
      height = value(n.frame.height);
    if (width <= 0 || height <= 0) throw Error("ERR_LAYOUT_SIZE");
    const ai = ["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"].indexOf(
        n.frame.anchor,
      ),
      ax = (ai % 3) / 2,
      ay = Math.floor(ai / 3) / 2;
    const box = {
      x: ref.x + value(n.frame.x) + ax * (ref.width - width),
      y: ref.y + value(n.frame.y) + ay * (ref.height - height),
      width,
      height,
    };
    boxes[n.id] = box;
    visiting.delete(n.id);
    return box;
  }
  layers.forEach(locate);
  // Profile patches are applied after responsive resolution; px/ratio are resolved against this profile.
  const patched = applyPatches(
    layers,
    project.profilePatches[profile.id] ?? [],
    "profile",
    origins,
  );
  for (const n of patched) {
    const before = layers.find((l) => l.id === n.id);
    if (!before || JSON.stringify(n.frame) !== JSON.stringify(before.frame)) {
      const f = n.frame;
      const v = (m: Frame["x"]) =>
        m.unit === "px"
          ? m.value
          : m.value * (m.base === "width" ? profile.width : profile.height);
      const ai = ["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"].indexOf(
        f.anchor,
      );
      const width = v(f.width),
        height = v(f.height);
      boxes[n.id] = {
        x: v(f.x) + ((ai % 3) / 2) * (profile.width - width),
        y: v(f.y) + (Math.floor(ai / 3) / 2) * (profile.height - height),
        width,
        height,
      };
    }
  }
  layers = patched;
  for (const n of layers) {
    const b = boxes[n.id];
    if (
      b.x < 0 ||
      b.y < 0 ||
      b.x + b.width > profile.width ||
      b.y + b.height > profile.height
    )
      warnings.push(`OUTSIDE:${n.id}`);
  }
  for (let i = 0; i < layers.length; i++)
    for (let j = i + 1; j < layers.length; j++) {
      if (
        !["text", "label"].includes(layers[i].type) ||
        !["text", "label"].includes(layers[j].type)
      )
        continue;
      const a = boxes[layers[i].id],
        b = boxes[layers[j].id];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
        warnings.push(`OVERLAP:${layers[i].id}:${layers[j].id}`);
    }
  return { layers, boxes, origins, warnings, profile };
}
export function validateWorkspace(input: unknown): Workspace {
  const w = workspaceSchema.parse(input);
  const globalIds = [
    ...w.templates,
    ...w.variants,
    ...w.projects,
    ...w.profiles,
    ...w.assets,
  ].map((r) => r.id);
  if (new Set(globalIds).size !== globalIds.length)
    throw Error("ERR_DUPLICATE_ID");
  const checkLayers = (ls: Layer[]) => {
    if (new Set(ls.map((n) => n.id)).size !== ls.length)
      throw Error("ERR_DUPLICATE_NODE");
    for (const n of ls) {
      const seen = new Set([n.id]);
      let pid = n.parentId;
      while (pid) {
        if (seen.has(pid)) throw Error("ERR_GROUP_CYCLE");
        seen.add(pid);
        const p = ls.find((n) => n.id === pid);
        if (!p || p.type !== "group") throw Error("ERR_GROUP_REFERENCE");
        pid = p.parentId;
      }
    }
  };
  w.templates.forEach((t) => checkLayers(t.layers));
  w.projects.forEach((p) => {
    checkLayers(p.templateSnapshot.layers);
    const profiles = w.profiles.filter((x) => p.profileIds.includes(x.id));
    if (profiles.length !== p.profileIds.length)
      throw Error("ERR_PROFILE_MISSING");
    for (const profile of profiles) checkLayers(resolve(p, profile).layers);
  });
  for (const a of w.assets)
    if (a.regions.some((r) => !polygonValid(r.polygon)))
      throw Error("ERR_REGION_POLYGON");
  return w;
}
export function bind(s: string, p: Project, profile?: Profile) {
  return s.replace(
    /\{\{([a-zA-Z0-9_]+)(?::([^}]+))?\}\}/g,
    (_, key: string, format: string) => {
      if (key === "serial")
        return String(p.serial).padStart(
          Math.min(10, Number(format) || 1),
          "0",
        );
      if (key === "date") {
        const [y, m, d] = p.date.split("-");
        return (format || "YYYY.MM.DD")
          .replace("YYYY", y)
          .replace("MM", m)
          .replace("DD", d);
      }
      if (key === "service") return profile?.name ?? "";
      return p.variables[key] ?? "";
    },
  );
}
// Control characters must be removed from exported filenames.
export function filename(raw: string, used: Set<string>) {
  const base =
    Array.from(raw, (c) => (c.charCodeAt(0) < 32 ? "_" : c))
      .join("")
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/[. ]+$/, "")
      .slice(0, 160) || "banner";
  let name = base + ".png",
    i = 2;
  while (used.has(name)) name = base + "_" + i++ + ".png";
  used.add(name);
  return name;
}
export const graphemes = (s: string) =>
  Array.from(
    new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(s),
    (x) => x.segment,
  );
export class History<T> {
  past: T[] = [];
  future: T[] = [];
  constructor(public present: T) {}
  commit(next: T) {
    this.past.push(clone(this.present));
    if (this.past.length > 60) this.past.shift();
    this.present = clone(next);
    this.future = [];
  }
  undo() {
    const p = this.past.pop();
    if (p) {
      this.future.push(this.present);
      this.present = p;
    }
    return clone(this.present);
  }
  redo() {
    const p = this.future.pop();
    if (p) {
      this.past.push(this.present);
      this.present = p;
    }
    return clone(this.present);
  }
}
