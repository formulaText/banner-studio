import { migrateWorkspace } from "./operations";
import Dexie, { type EntityTable } from "dexie";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { clone, uid, type Workspace, workspaceSchema } from "./model";
import { validateWorkspace } from "./document";
export const MAX_ZIP = 80 * 1024 * 1024,
  MAX_EXPANDED = 160 * 1024 * 1024;
export const sha256 = async (data: Uint8Array | ArrayBuffer) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(
          data instanceof ArrayBuffer ? data : data.slice().buffer,
        ),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export class StudioDB extends Dexie {
  state!: EntityTable<
    { id: string; value: Workspace; generation: number },
    "id"
  >;
  blobs!: EntityTable<{ id: string; blob: Blob }, "id">;
  constructor(name = "banner-studio-v1") {
    super(name);
    this.version(1).stores({ state: "id", blobs: "id" });
  }
  async load() {
    const s = await this.state.get("workspace");
    return s
      ? {
          value: validateWorkspace(migrateWorkspace(s.value)),
          generation: s.generation,
        }
      : undefined;
  }
  async save(
    value: Workspace,
    expected: number,
    blobs: Map<string, Blob> = new Map(),
  ) {
    const valid = validateWorkspace(value);
    return this.transaction("rw", this.state, this.blobs, async () => {
      const current = await this.state.get("workspace");
      if ((current?.generation ?? 0) !== expected)
        throw Error("ERR_STORAGE_CONFLICT");
      for (const [id, blob] of blobs) await this.blobs.put({ id, blob });
      const generation = expected + 1;
      await this.state.put({ id: "workspace", value: valid, generation });
      return generation;
    });
  }
  async blob(id: string) {
    return (await this.blobs.get(id))?.blob;
  }
}
export const db = new StudioDB();
export async function createBackup(
  w: Workspace,
  getBlob: (id: string) => Promise<Blob | undefined>,
  includeAssets: boolean,
) {
  const files: Record<string, Uint8Array> = {
    "data/workspace.json": strToU8(JSON.stringify(validateWorkspace(w))),
  };
  const omitted: string[] = [];
  if (includeAssets)
    for (const a of w.assets) {
      if (!a.redistributable) {
        omitted.push(a.id);
        continue;
      }
      const blob = await getBlob(a.blobKey);
      if (blob)
        files[`assets/${a.blobKey}`] = new Uint8Array(await blob.arrayBuffer());
      else omitted.push(a.id);
    }
  const entries = [];
  for (const [path, data] of Object.entries(files))
    entries.push({ path, size: data.length, sha256: await sha256(data) });
  files["manifest.json"] = strToU8(
    JSON.stringify({
      format: "banner-studio-backup",
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      entries,
      omitted,
    }),
  );
  return new Blob([new Uint8Array(zipSync(files, { level: 6 })).buffer], {
    type: "application/zip",
  });
}
export function safeUnzip(bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.length > MAX_ZIP || bytes.length < 22) throw Error("ERR_ZIP_SIZE");
  // Inspect central directory before decompression; declared bounds also checked against actual inflated lengths.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  )
    throw Error("ERR_ZIP_HEADER");
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true),
    size = 0;
  const names = new Set<string>();
  if (count > 1100) throw Error("ERR_ZIP_COUNT");
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      throw Error("ERR_ZIP_HEADER");
    const n = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true);
    size += view.getUint32(pos + 24, true);
    const name = strFromU8(bytes.slice(pos + 46, pos + 46 + n));
    if (
      size > MAX_EXPANDED ||
      names.has(name) ||
      !/^(manifest\.json|data\/workspace\.json|assets\/[a-zA-Z0-9-]+|diagnostic\.json)$/.test(
        name,
      )
    )
      throw Error("ERR_ZIP_PATH_OR_SIZE");
    names.add(name);
    pos += 46 + n + extra + comment;
  }
  let filtered = 0;
  const result = unzipSync(bytes, {
    filter: (f) => {
      filtered += f.originalSize;
      if (filtered > MAX_EXPANDED || !names.has(f.name))
        throw Error("ERR_ZIP_SIZE");
      return true;
    },
  });
  if (
    Object.values(result).reduce((s, x) => s + x.length, 0) > MAX_EXPANDED ||
    Object.keys(result).length !== count
  )
    throw Error("ERR_ZIP_SIZE");
  return result;
}
export async function readBackup(blob: Blob): Promise<{
  workspace: Workspace;
  blobs: Map<string, Blob>;
  missing: string[];
}> {
  const files = safeUnzip(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(
    strFromU8(files["manifest.json"] ?? new Uint8Array()),
  ) as {
    format: string;
    formatVersion: number;
    entries: { path: string; size: number; sha256: string }[];
  };
  if (
    manifest.format !== "banner-studio-backup" ||
    manifest.formatVersion !== 1 ||
    !Array.isArray(manifest.entries)
  )
    throw Error("ERR_BACKUP_FORMAT");
  if (
    new Set(manifest.entries.map((e) => e.path)).size !==
      manifest.entries.length ||
    manifest.entries.length !== Object.keys(files).length - 1
  )
    throw Error("ERR_BACKUP_MANIFEST");
  for (const entry of manifest.entries) {
    const data = files[entry.path];
    if (
      !data ||
      data.length !== entry.size ||
      (await sha256(data)) !== entry.sha256
    )
      throw Error("ERR_BACKUP_CHECKSUM");
  }
  const w = validateWorkspace(
    migrateWorkspace(JSON.parse(strFromU8(files["data/workspace.json"]))),
  );
  const blobs = new Map<string, Blob>(),
    missing: string[] = [];
  for (const a of w.assets) {
    const data = files[`assets/${a.blobKey}`];
    if (!data) {
      missing.push(a.id);
      continue;
    }
    if ((await sha256(data)) !== a.sha256) throw Error("ERR_ASSET_CHECKSUM");
    blobs.set(
      a.blobKey,
      new Blob([new Uint8Array(data).buffer], { type: a.mime }),
    );
  }
  return { workspace: w, blobs, missing };
}
export function mergeWorkspace(
  current: Workspace,
  incoming: Workspace,
  blobs: Map<string, Blob>,
) {
  const map = new Map<string, string>();
  const gather = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(gather);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if ((k === "id" || k === "blobKey") && typeof v === "string")
          map.set(v, map.get(v) ?? uid());
        gather(v);
      }
    }
  };
  gather(incoming);
  const remap = (value: unknown): unknown => {
    if (typeof value === "string") return map.get(value) ?? value;
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [map.get(k) ?? k, remap(v)]),
      );
    return value;
  };
  const w = workspaceSchema.parse(remap(incoming));
  const out = clone(current);
  for (const key of [
    "templates",
    "variants",
    "projects",
    "profiles",
    "assets",
    "labels",
    "presets",
  ] as const)
    Object.assign(out, { [key]: [...out[key], ...w[key]] });
  out.revision++;
  const mapped = new Map<string, Blob>();
  for (const [key, value] of blobs) mapped.set(map.get(key) ?? key, value);
  return { workspace: validateWorkspace(out), blobs: mapped };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
