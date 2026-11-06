import type { Point, Placement, Region, Layer, SplitLine } from "./model";
export const rect = (w: number, h: number): Point[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];
export function area(p: Point[]): number {
  return (
    Math.abs(
      p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function clipHalf(poly: Point[], a: Point, b: Point, side = 1): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    const dp = cross(a, b, p) * side,
      dq = cross(a, b, q) * side;
    const pi = dp >= -1e-8,
      qi = dq >= -1e-8;
    if (pi) out.push(p);
    if (pi !== qi) {
      const t = dp / (dp - dq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}
export function intersect(subject: Point[], clip: Point[]): Point[] {
  let p = subject;
  for (let i = 0; i < clip.length; i++)
    p = clipHalf(p, clip[i], clip[(i + 1) % clip.length]);
  return p;
}
export function splitCells(
  w: number,
  h: number,
  lines: SplitLine[],
): { id: string; polygon: Point[] }[] {
  let cells = [{ id: "root", polygon: rect(w, h) }];
  for (const line of lines.filter((l) => l.enabled)) {
    const r = (line.angle * Math.PI) / 180;
    const a: Point = [line.position[0] * w, line.position[1] * h],
      b: Point = [a[0] + Math.cos(r), a[1] + Math.sin(r)];
    cells = cells.flatMap((c) =>
      [1, -1]
        .map((side) => ({
          id: `${c.id}/${line.id}:${side}`,
          polygon: clipHalf(c.polygon, a, b, side),
        }))
        .filter((c) => area(c.polygon) > 1e-5),
    );
  }
  return cells;
}
export function transform(
  poly: Point[],
  iw: number,
  ih: number,
  w: number,
  h: number,
  p: Placement,
  fit: "cover" | "contain" = "cover",
): Point[] {
  const s =
      (fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)) *
      p.scale,
    r = (p.rotation * Math.PI) / 180,
    c = Math.cos(r),
    sn = Math.sin(r);
  return poly.map(([x, y]) => {
    const a = (x - p.pivot[0]) * iw * s,
      b = (y - p.pivot[1]) * ih * s;
    return [p.x * w + a * c - b * sn, p.y * h + a * sn + b * c];
  });
}
export function polygonValid(p: Point[]): boolean {
  if (
    p.length < 3 ||
    area(p) < 1e-10 ||
    p.some((q) => q.some((n) => !Number.isFinite(n) || n < 0 || n > 1))
  )
    return false;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      const a = p[i],
        b = p[(i + 1) % p.length],
        c = p[j],
        d = p[(j + 1) % p.length];
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      )
        return false;
    }
  return true;
}
export const angleDelta = (a: number, b: number) =>
  ((((a - b + 540) % 360) + 360) % 360) - 180;
export type Score = {
  keep: number;
  anchor: number;
  size: number;
  avoid: number;
  exit: number;
  scale: number;
  rotation: number;
  blank: number;
};
export interface Candidate {
  placement: Placement;
  score: Score;
  total: number;
  conflict: boolean;
  version: string;
}
export function evaluate(
  p: Placement,
  source: Placement,
  iw: number,
  ih: number,
  w: number,
  h: number,
  clip: Point[],
  regions: Region[],
  settings: Layer["composition"],
  sourceSize: Point = [w, h],
  fit: "cover" | "contain" = "cover",
): Candidate {
  const score: Score = {
    keep: 0,
    anchor: 0,
    size: 0,
    avoid: 0,
    exit: 0,
    scale: Math.abs(Math.log(p.scale / source.scale)),
    rotation: Math.abs(angleDelta(p.rotation, source.rotation)) / 180,
    blank: 0,
  };
  for (const r of regions) {
    const poly = transform(r.polygon, iw, ih, w, h, p, fit),
      a = area(poly),
      visible = a ? area(intersect(poly, clip)) / a : 0;
    const center: Point = [
      poly.reduce((s, q) => s + q[0], 0) / poly.length / w,
      poly.reduce((s, q) => s + q[1], 0) / poly.length / h,
    ];
    if (r.type === "keep") {
      score.keep += (1 - visible) * r.priority;
      score.anchor +=
        ((center[0] - r.target[0]) ** 2 + (center[1] - r.target[1]) ** 2) *
        r.priority;
      const sourcePoly = transform(
        r.polygon,
        iw,
        ih,
        ...sourceSize,
        source,
        fit,
      );
      score.size +=
        Math.abs(
          Math.sqrt(a / (w * h)) -
            Math.sqrt(area(sourcePoly) / (sourceSize[0] * sourceSize[1])),
        ) * r.priority;
    } else {
      score.avoid += visible * r.priority;
      const distance = {
        left: center[0],
        right: 1 - center[0],
        top: center[1],
        bottom: 1 - center[1],
      }[r.exit];
      score.exit += Math.max(0, distance) * r.priority;
    }
  }
  score.blank = Math.max(
    0,
    1 -
      area(intersect(transform(rect(1, 1), iw, ih, w, h, p, fit), clip)) /
        Math.max(area(clip), 1e-10),
  );
  const conflict = regions.some(
    (a) =>
      a.type === "keep" &&
      regions.some(
        (b) =>
          b.type === "avoid" && area(intersect(a.polygon, b.polygon)) > 1e-8,
      ),
  );
  return {
    placement: p,
    score,
    total: (Object.keys(score) as (keyof Score)[]).reduce(
      (s, k) => s + score[k] * settings.weights[k],
      0,
    ),
    conflict,
    version: "geometry-search-1",
  };
}
export function optimize(
  source: Placement,
  iw: number,
  ih: number,
  w: number,
  h: number,
  clip: Point[],
  regions: Region[],
  settings: Layer["composition"],
  sourceSize: Point = [w, h],
  fit: "cover" | "contain" = "cover",
): Candidate[] {
  if (
    ![iw, ih, w, h, settings.minScale, settings.maxScale].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    settings.minScale > settings.maxScale ||
    regions.some((r) => !polygonValid(r.polygon))
  )
    throw Error("ERR_CROP_INVALID");
  const delta = settings.mode === "fixed" ? 0 : settings.maxDelta;
  const angles =
    delta === 0
      ? [source.rotation]
      : [-1, -0.5, 0, 0.5, 1].map((v) => source.rotation + v * delta);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  function add(x: number, y: number, scale: number, rotation: number) {
    if (
      scale < settings.minScale ||
      scale > settings.maxScale ||
      Math.abs(rotation - source.rotation) > delta + 1e-9
    )
      return;
    const p = {
      ...source,
      x,
      y,
      scale,
      rotation: delta === 0 ? source.rotation : rotation,
    };
    const key = JSON.stringify(p);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(
      evaluate(
        p,
        source,
        iw,
        ih,
        w,
        h,
        clip,
        regions,
        settings,
        sourceSize,
        fit,
      ),
    );
  }
  const scales = [
    source.scale,
    ...Array.from(
      { length: 5 },
      (_, i) =>
        settings.minScale * (settings.maxScale / settings.minScale) ** (i / 4),
    ),
  ];
  for (const angle of angles)
    for (const scale of scales)
      for (const x of [-0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, source.x])
        for (const y of [-0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, source.y])
          add(x, y, scale, angle);
  const compare = (a: Candidate, b: Candidate) =>
    a.total - b.total ||
    Math.abs(angleDelta(a.placement.rotation, source.rotation)) -
      Math.abs(angleDelta(b.placement.rotation, source.rotation)) ||
    a.score.scale - b.score.scale ||
    Math.hypot(a.placement.x - source.x, a.placement.y - source.y) -
      Math.hypot(b.placement.x - source.x, b.placement.y - source.y) ||
    a.placement.x - b.placement.x ||
    a.placement.y - b.placement.y ||
    a.placement.scale - b.placement.scale ||
    a.placement.rotation - b.placement.rotation;
  candidates.sort(compare);
  for (const step of [0.08, 0.025]) {
    for (const c of candidates.slice(0, 4))
      for (const dx of [-step, 0, step])
        for (const dy of [-step, 0, step])
          for (const ds of [-step, 0, step])
            add(
              c.placement.x + dx,
              c.placement.y + dy,
              c.placement.scale * Math.exp(ds),
              c.placement.rotation,
            );
    candidates.sort(compare);
  }
  return candidates.slice(0, 5);
}
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function particles(config: Layer["particle"], w: number, h: number) {
  const random = seeded(config.seed);
  return Array.from({ length: config.count }, () => {
    const x = random() * w,
      y = random() * h,
      phase = random() * config.life,
      size = config.size * (0.4 + random()),
      age = (config.time + phase) % config.life;
    return {
      x: (x + Math.sin(age + phase) * config.sway + w) % w,
      y: (y + age * config.speed + 0.5 * config.gravity * age * age + h) % h,
      size,
      alpha: Math.sin((age / config.life) * Math.PI),
      rotation: phase + age,
    };
  });
}
