import { useEffect, useRef, useState } from "react";
import { type Asset, type Region, type Point, uid } from "./model";
import { Select } from "./fields";
export function RegionEditor({
  asset,
  regions,
  getBlob,
  onChange,
}: {
  asset: Asset;
  regions: Region[];
  getBlob: (id: string) => Promise<Blob | undefined>;
  onChange: (r: Region[]) => void;
}) {
  const [url, setURL] = useState(""),
    [type, setType] = useState<"keep" | "avoid">("keep"),
    [draft, setDraft] = useState<Point[] | null>(null),
    start = useRef<Point | null>(null);
  useEffect(() => {
    let active = true,
      url = "";
    void getBlob(asset.blobKey).then((blob) => {
      if (blob && active) {
        url = URL.createObjectURL(blob);
        setURL(url);
      }
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.blobKey, getBlob]);
  return (
    <div>
      <Select
        label="描く領域"
        value={type}
        options={[
          { value: "keep", label: "keep / 保持する" },
          { value: "avoid", label: "avoid / 除外する" },
        ]}
        onChange={setType}
      />
      <p className="hint">
        元画像を指またはマウスでドラッグして矩形を追加。下の設定で位置・優先度を調整できます。
      </p>
      <div
        className="region-editor"
        style={{ aspectRatio: `${asset.width}/${asset.height}` }}
      >
        {url && <img src={url} alt="領域指定用の元画像" />}
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-label="元画像の領域指定"
          onPointerDown={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            start.current = [
              (e.clientX - b.left) / b.width,
              (e.clientY - b.top) / b.height,
            ];
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const b = e.currentTarget.getBoundingClientRect(),
              x = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
              y = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
            const [sx, sy] = start.current;
            setDraft([
              [Math.min(sx, x), Math.min(sy, y)],
              [Math.max(sx, x), Math.min(sy, y)],
              [Math.max(sx, x), Math.max(sy, y)],
              [Math.min(sx, x), Math.max(sy, y)],
            ]);
          }}
          onPointerUp={() => {
            if (
              draft &&
              Math.abs(draft[2][0] - draft[0][0]) > 0.01 &&
              Math.abs(draft[2][1] - draft[0][1]) > 0.01
            )
              onChange([
                ...regions,
                {
                  id: uid(),
                  type,
                  polygon: draft,
                  priority: 1,
                  target: [0.5, 0.5],
                  exit: "bottom",
                  anchor: "cc",
                },
              ]);
            start.current = null;
            setDraft(null);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDraft(null);
          }}
        >
          {regions.map((r) => (
            <polygon
              key={r.id}
              points={r.polygon.map((p) => p.join(",")).join(" ")}
              fill={r.type === "keep" ? "#3bcd9266" : "#ff735366"}
              stroke={r.type === "keep" ? "#2ebd86" : "#ef664d"}
              strokeWidth=".006"
            />
          ))}
          {draft && (
            <polygon
              points={draft.map((p) => p.join(",")).join(" ")}
              fill="#ffffff44"
              stroke="white"
              strokeWidth=".006"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
