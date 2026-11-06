import { zipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
import { safeUnzip } from "./storage";
import {
  type Project,
  type Profile,
  type Workspace,
  initialWorkspace,
  layer,
  m,
} from "./model";
import { resolve } from "./document";
export interface LogEvent {
  timestamp: string;
  sessionId: string;
  level: "info" | "error" | "warn";
  category: string;
  code: string;
  documentRevision: number;
  context: Record<string, number | boolean>;
}
export class Diagnostics {
  enabled = false;
  events: LogEvent[] = [];
  sessionId = crypto.randomUUID();
  record(
    category: string,
    code: string,
    revision = 0,
    context: Record<string, number | boolean> = {},
    level: LogEvent["level"] = "info",
  ) {
    if (!this.enabled && level !== "error") return;
    this.events.push({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level,
      category,
      code,
      documentRevision: revision,
      context,
    });
    if (this.events.length > 300) this.events.shift();
  }
}
export const diagnostics = new Diagnostics();
export function errorCode(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "ERR_DB_QUOTA";
  const msg = error instanceof Error ? error.message : "";
  return /^ERR_[A-Z_]+$/.test(msg) ? msg : "ERR_OPERATION_FAILED";
}
const redactedSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
  }),
  layers: z
    .array(
      z.object({
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
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().positive(),
        height: z.number().positive(),
        rotation: z.number().finite(),
        opacity: z.number().min(0).max(1),
        visible: z.boolean(),
        effectCount: z.number().int().min(0).max(20),
      }),
    )
    .max(200),
});
export function redactedState(p: Project, profile: Profile) {
  const r = resolve(p, profile);
  return {
    version: 1 as const,
    profile: { width: profile.width, height: profile.height },
    layers: r.layers.map((n) => ({
      type: n.type,
      ...r.boxes[n.id],
      rotation: n.rotation,
      opacity: n.opacity,
      visible: n.visible,
      effectCount: n.effects.length,
    })),
  };
}
export function diagnosticBundle(p: Project, profile: Profile) {
  const state = redactedState(p, profile);
  return new Blob(
    [
      new Uint8Array(
        zipSync({
          "manifest.json": strToU8(
            JSON.stringify({
              format: "banner-studio-diagnostic",
              version: 1,
              includeAssets: false,
              includeText: false,
              appVersion: "0.1.0-integrated",
              note: "素材・本文・名前・IDを除外。描画設定の完全再現ではありません。",
            }),
          ),
          "diagnostic.json": strToU8(JSON.stringify(state)),
        }),
      ).buffer,
    ],
    { type: "application/zip" },
  );
}
export async function importDiagnostic(blob: Blob): Promise<Workspace> {
  const files = safeUnzip(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  if (manifest.format !== "banner-studio-diagnostic")
    throw Error("ERR_DIAGNOSTIC_FORMAT");
  const s = redactedSchema.parse(
    JSON.parse(strFromU8(files["diagnostic.json"])),
  );
  const w = initialWorkspace(),
    p = w.projects[0];
  w.profiles = w.profiles.slice(0, 1);
  w.profiles[0].width = s.profile.width;
  w.profiles[0].height = s.profile.height;
  p.profileIds = [w.profiles[0].id];
  p.name = "隔離診断（素材省略）";
  p.templateSnapshot.layers = s.layers.map((n, i) => {
    const l = layer(
      n.type === "image" || n.type === "split" ? "shape" : n.type,
      `匿名レイヤー ${i + 1}`,
    );
    l.frame = {
      x: m(n.x, "px"),
      y: m(n.y, "px", "height"),
      width: m(n.width, "px"),
      height: m(n.height, "px", "height"),
      anchor: "tl",
      relativeTo: "canvas",
    };
    l.rotation = n.rotation;
    l.opacity = n.opacity;
    l.visible = n.visible;
    l.text = "匿名テキスト";
    return l;
  });
  return w;
}
