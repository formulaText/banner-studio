import { useEffect, useRef, useState } from "react";
import {
  type Project,
  type Profile,
  type Asset,
  type Layer,
  m,
  clone,
} from "./model";
import { StudioRenderer, type RenderReport } from "./renderer";
import { resolve } from "./document";
import { type Candidate } from "./geometry";
export function Canvas({
  project,
  profile,
  assets,
  getBlob,
  selected,
  onSelect,
  onEdit,
  guides,
  stage,
  onReport,
  onError,
  navigate,
  zoom,
  onZoom,
}: {
  project: Project;
  profile: Profile;
  assets: Asset[];
  getBlob: (id: string) => Promise<Blob | undefined>;
  selected: string;
  onSelect: (id: string) => void;
  onEdit: (n: Layer) => void;
  guides: boolean;
  stage: string;
  onReport: (r: RenderReport) => void;
  onError: (e: unknown) => void;
  navigate: boolean;
  zoom: number;
  onZoom: (value: number) => void;
  candidates?: Candidate[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<StudioRenderer | null>(null),
    chain = useRef(Promise.resolve()),
    [ready, setReady] = useState(false),
    [rendering, setRendering] = useState(true),
    drag = useRef<{ x: number; y: number; n: Layer; mode: string } | null>(
      null,
    ),
    [shift, setShift] = useState({ x: 0, y: 0 }),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 600, height: 400 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setViewportSize({
        width: element.clientWidth - 8,
        height: element.clientHeight - 44,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const callbacks = useRef({ onReport, onError });
  useEffect(() => {
    callbacks.current = { onReport, onError };
  });
  useEffect(() => {
    let active = true;
    const r = new StudioRenderer();
    renderer.current = r;
    chain.current = r
      .init(canvas.current!)
      .then(() => {
        if (active) setReady(true);
      })
      .catch((e) => callbacks.current.onError(e));
    return () => {
      active = false;
      void chain.current.finally(() => r.destroy());
    };
  }, []);
  const signature = JSON.stringify([project, profile, assets, stage]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setRendering(true);
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        if (!active) return;
        try {
          const result = await renderer.current!.render(
            project,
            profile,
            assets,
            getBlob,
            stage,
          );
          if (active) {
            callbacks.current.onReport(result.report);
            setRendering(false);
          }
        } catch (e) {
          if (active) {
            callbacks.current.onError(e);
            setRendering(false);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [signature, getBlob, ready]);
  let resolved: ReturnType<typeof resolve>;
  try {
    resolved = resolve(project, profile);
  } catch {
    return <p role="alert">レイアウトの参照・寸法を確認してください。</p>;
  }
  const node = resolved.layers.find((n) => n.id === selected),
    box = node ? resolved.boxes[node.id] : undefined;
  return (
    <div className="canvas-viewport" ref={viewport}>
      <div
        className="artboard"
        style={{
          aspectRatio: `${profile.width}/${profile.height}`,
          width: `${Math.min(viewportSize.width, (viewportSize.height * profile.width) / profile.height) * zoom}px`,
          maxHeight: "none",
          transform: `translate(${pan.x + (drag.current?.mode === "pan" ? shift.x : 0)}px,${pan.y + (drag.current?.mode === "pan" ? shift.y : 0)}px)`,
        }}
      >
        <canvas ref={canvas} aria-label="バナープレビュー" />
        {guides && (
          <svg
            className="guides"
            viewBox={`0 0 ${profile.width} ${profile.height}`}
          >
            <rect
              x={profile.width * profile.safe}
              y={profile.height * profile.safe}
              width={profile.width * (1 - profile.safe * 2)}
              height={profile.height * (1 - profile.safe * 2)}
              fill="none"
              stroke="#ffffffaa"
              strokeWidth="2"
              strokeDasharray="10 8"
            />
            {profile.overlays.map((p, i) => (
              <polygon
                key={i}
                points={p.map((q) => q.join(",")).join(" ")}
                fill="#f9731644"
              />
            ))}
          </svg>
        )}
        <svg
          className="interaction"
          aria-label="キャンバス編集"
          viewBox={`0 0 ${profile.width} ${profile.height}`}
          onPointerDown={(e) => {
            if (rendering) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            e.currentTarget.setPointerCapture(e.pointerId);
            if (pointers.current.size === 2) {
              const [a, b] = [...pointers.current.values()];
              pinch.current = {
                distance: Math.hypot(a.x - b.x, a.y - b.y),
                zoom,
              };
              drag.current = null;
              setShift({ x: 0, y: 0 });
              return;
            }
            const bounds = e.currentTarget.getBoundingClientRect(),
              x = ((e.clientX - bounds.left) / bounds.width) * profile.width,
              y = ((e.clientY - bounds.top) / bounds.height) * profile.height;
            const target = (e.target as Element).getAttribute("data-handle");
            if (navigate) {
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                n: node ?? resolved.layers[0],
                mode: "pan",
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
            const hit =
              target && node
                ? node
                : [...resolved.layers].reverse().find((n) => {
                    const b = resolved.boxes[n.id];
                    const radians = (-n.rotation * Math.PI) / 180,
                      dx = x - b.x - b.width / 2,
                      dy = y - b.y - b.height / 2;
                    const localX =
                        dx * Math.cos(radians) -
                        dy * Math.sin(radians) +
                        b.width / 2,
                      localY =
                        dx * Math.sin(radians) +
                        dy * Math.cos(radians) +
                        b.height / 2;
                    return (
                      n.visible &&
                      n.type !== "adjustment" &&
                      localX >= 0 &&
                      localX <= b.width &&
                      localY >= 0 &&
                      localY <= b.height
                    );
                  });
            if (hit) {
              onSelect(hit.id);
              if (!hit.locked) {
                drag.current = { x, y, n: clone(hit), mode: target ?? "move" };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }
          }}
          onPointerMove={(e) => {
            if (pointers.current.has(e.pointerId))
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch.current && pointers.current.size === 2) {
              const [a, b] = [...pointers.current.values()];
              onZoom(
                Math.max(
                  0.3,
                  Math.min(
                    3,
                    (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
                      Math.max(1, pinch.current.distance),
                  ),
                ),
              );
              return;
            }
            const d = drag.current;
            if (!d) return;
            if (d.mode === "pan") {
              setShift({ x: e.clientX - d.x, y: e.clientY - d.y });
              return;
            }
            const b = e.currentTarget.getBoundingClientRect();
            setShift({
              x: ((e.clientX - b.left) / b.width) * profile.width - d.x,
              y: ((e.clientY - b.top) / b.height) * profile.height - d.y,
            });
          }}
          onPointerUp={(e) => {
            pointers.current.delete(e.pointerId);
            if (pinch.current) {
              pinch.current = null;
              drag.current = null;
              setShift({ x: 0, y: 0 });
              return;
            }
            const d = drag.current;
            if (!d) return;
            if (d.mode === "pan")
              setPan((p) => ({ x: p.x + shift.x, y: p.y + shift.y }));
            else {
              const b = resolved.boxes[d.n.id],
                n = clone(d.n);
              if (d.mode === "rotate") n.rotation += shift.x * 0.3;
              else if (d.mode === "resize") {
                n.frame.width = m(Math.max(20, b.width + shift.x), "px");
                n.frame.height = m(
                  Math.max(20, b.height + shift.y),
                  "px",
                  "height",
                );
              } else {
                n.frame.x = m(Math.round((b.x + shift.x) / 5) * 5, "px");
                n.frame.y = m(
                  Math.round((b.y + shift.y) / 5) * 5,
                  "px",
                  "height",
                );
                n.frame.anchor = "tl";
                n.frame.relativeTo = "canvas";
              }
              onEdit(n);
            }
            drag.current = null;
            setShift({ x: 0, y: 0 });
          }}
          onPointerCancel={() => {
            pointers.current.clear();
            pinch.current = null;
            drag.current = null;
            setShift({ x: 0, y: 0 });
          }}
        >
          {box && node && (
            <g
              transform={`translate(${shift.x},${shift.y}) rotate(${node.rotation} ${box.x + box.width / 2} ${box.y + box.height / 2})`}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="none"
                stroke="#efbf74"
                strokeWidth="3"
              />
              {!node.locked && (
                <>
                  <circle
                    data-handle="rotate"
                    cx={box.x + box.width / 2}
                    cy={box.y - 28}
                    r="16"
                    fill="#efbf74"
                  />
                  <rect
                    data-handle="resize"
                    x={box.x + box.width - 14}
                    y={box.y + box.height - 14}
                    width="28"
                    height="28"
                    fill="#efbf74"
                  />
                </>
              )}
            </g>
          )}
        </svg>
      </div>
      {rendering && <span className="render-indicator">描画中…</span>}
    </div>
  );
}
