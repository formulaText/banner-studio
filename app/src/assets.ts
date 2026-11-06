import { record, type Asset } from "./model";
import { sha256 } from "./storage";
export function sanitizeSVG(source: string): string {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw Error("ERR_SVG_FORMAT");
  const allowed = new Set([
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "title",
    "desc",
  ]);
  const attrs = new Set([
    "xmlns",
    "viewBox",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "transform",
    "offset",
    "stop-color",
    "stop-opacity",
    "id",
    "gradientUnits",
    "gradientTransform",
    "clip-path",
  ]);
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    if (!allowed.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const a of Array.from(el.attributes)) {
      if (
        !attrs.has(a.name) ||
        /javascript:|data:|https?:|\/\/|url\((?!#[\w-]+\))|expression/i.test(
          a.value,
        )
      )
        el.removeAttribute(a.name);
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export async function importAsset(
  file: File,
  library = false,
): Promise<{ asset: Asset; blob: Blob }> {
  if (file.size > 40 * 1024 * 1024) throw Error("ERR_ASSET_TOO_LARGE");
  let blob: Blob = file;
  let width = 0,
    height = 0;
  const font = /\.(ttf|otf|woff2?)$/i.test(file.name);
  const svg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (font) {
    if (file.size > 20 * 1024 * 1024) throw Error("ERR_FONT_TOO_LARGE");
    const sig = new DataView(await file.slice(0, 4).arrayBuffer()).getUint32(0);
    if (![0x00010000, 0x4f54544f, 0x774f4646, 0x774f4632].includes(sig))
      throw Error("ERR_FONT_FORMAT");
  } else if (svg)
    blob = new Blob([sanitizeSVG(await file.text())], {
      type: "image/svg+xml",
    });
  else {
    const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!(
      (h[0] === 137 && h[1] === 80 && h[2] === 78 && h[3] === 71) ||
      (h[0] === 255 && h[1] === 216) ||
      (String.fromCharCode(...h.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...h.slice(8, 12)) === "WEBP")
    ))
      throw Error("ERR_IMAGE_FORMAT");
  }
  if (!font) {
    const img = await loadImage(blob);
    width = img.naturalWidth;
    height = img.naturalHeight;
    if (width * height > 40_000_000 || !width || !height)
      throw Error("ERR_IMAGE_DIMENSIONS");
  }
  const base = record();
  return {
    asset: {
      ...base,
      name: file.name,
      kind: font ? "font" : svg ? "svg" : "image",
      mime: blob.type,
      sha256: await sha256(await blob.arrayBuffer()),
      blobKey: base.id,
      width,
      height,
      regions: [],
      license: "未確認",
      redistributable: false,
      library,
      previousId: "",
    },
    blob,
  };
}
export async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(Error("ERR_IMAGE_LOAD"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function loadFont(asset: Asset, blob: Blob) {
  const face = new FontFace(`asset-${asset.id}`, await blob.arrayBuffer());
  try {
    await face.load();
    document.fonts.add(face);
    return face.family;
  } catch {
    throw Error("ERR_FONT_LOAD");
  }
}
export async function webFont(url: string, family: string) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw Error("ERR_FONT_URL");
  const response = await fetch(u, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw Error("ERR_FONT_LOAD");
  const blob = await response.blob();
  if (blob.size > 20 * 1024 * 1024) throw Error("ERR_FONT_TOO_LARGE");
  const face = new FontFace(family, await blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  return face;
}
export async function extractColors(blob: Blob) {
  const img = await loadImage(blob),
    c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 64, 64);
  const pixels = ctx.getImageData(0, 0, 64, 64).data,
    counts = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const color =
      "#" +
      [pixels[i], pixels[i + 1], pixels[i + 2]]
        .map((v) =>
          (Math.round(v / 32) * 32 > 255 ? 255 : Math.round(v / 32) * 32)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((x) => x[0]);
}
export function contrast(a: string, b: string) {
  const luminance = (s: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
