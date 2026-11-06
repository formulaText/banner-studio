import { RegionEditor } from "./RegionEditor";
import {
  type Layer,
  type Asset,
  type Slot,
  type Effect,
  type Region,
  effect,
  uid,
  placement,
  nodeSchema,
  regionSchema,
  clone,
} from "./model";
import { Field, Num, Select, Check, JsonEditor } from "./fields";
import { z } from "zod";
export function Effects({
  value,
  onChange,
}: {
  value: Effect[];
  onChange: (v: Effect[]) => void;
}) {
  const update = (i: number, e: Effect) =>
    onChange(value.map((v, j) => (i === j ? e : v)));
  return (
    <>
      <div className="button-row">
        <select
          aria-label="追加する効果"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value)
              onChange([...value, effect(e.target.value as Effect["type"])]);
            e.target.value = "";
          }}
        >
          <option value="">＋ 効果を追加</option>
          {[
            ["blur", "ぼかし"],
            ["variableBlur", "可変ぼかし（試作）"],
            ["noise", "ノイズ"],
            ["brightness", "明度"],
            ["saturation", "彩度"],
            ["tint", "ティント"],
            ["ink", "すみだまり（試作）"],
          ].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {value.map((e, i) => (
        <div className="inset" key={e.id}>
          <Check
            label={e.type}
            value={e.enabled}
            onChange={(v) => update(i, { ...e, enabled: v })}
          />
          <Num
            label={e.type + " 強度"}
            value={e.amount}
            min={0}
            max={100}
            onChange={(v) => update(i, { ...e, amount: v })}
          />
          {e.type === "tint" && (
            <Field
              label="ティント色"
              type="color"
              value={e.color}
              onChange={(v) => update(i, { ...e, color: v })}
            />
          )}
          <div className="button-row">
            <button
              disabled={i === 0}
              onClick={() => {
                const a = [...value];
                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                onChange(a);
              }}
            >
              効果を前へ
            </button>
            <button onClick={() => onChange(value.filter((_, j) => i !== j))}>
              効果を削除
            </button>
          </div>
          {e.type === "variableBlur" && (
            <>
              <Check
                label="ぼかし領域を反転"
                value={e.reverse}
                onChange={(v) => update(i, { ...e, reverse: v })}
              />
              <Num
                label="フェザー"
                min={0}
                max={1}
                value={e.feather}
                onChange={(v) => update(i, { ...e, feather: v })}
              />
              <Num
                label="減衰カーブ"
                min={0.1}
                max={10}
                value={e.curve}
                onChange={(v) => update(i, { ...e, curve: v })}
              />
              <Select
                label="効果マスク"
                value={e.shape}
                options={["rect", "ellipse", "rounded"]}
                onChange={(v) => update(i, { ...e, shape: v })}
              />
            </>
          )}
        </div>
      ))}
      <JsonEditor
        label="効果スタック"
        value={value}
        onApply={(v) => onChange(nodeSchema.shape.effects.parse(v))}
      />
    </>
  );
}
export function Inspector({
  node,
  assets,
  layers,
  onChange,
  onAsset,
  onOptimize,
  onRestore,
  getBlob,
  slotIndex,
  setSlotIndex,
}: {
  node: Layer;
  assets: Asset[];
  layers: Layer[];
  onChange: (n: Layer) => void;
  onAsset: (a: Asset) => void;
  onOptimize: () => void;
  onRestore: () => void;
  getBlob: (id: string) => Promise<Blob | undefined>;
  slotIndex: number;
  setSlotIndex: (i: number) => void;
}) {
  const n = node;
  const set = <K extends keyof Layer>(key: K, value: Layer[K]) =>
    onChange({ ...n, [key]: value });
  const slot = n.slots[slotIndex],
    asset = assets.find((a) => a.id === slot?.assetId);
  const setSlot = (s: Slot) =>
    set(
      "slots",
      n.slots.map((a, i) => (i === slotIndex ? s : a)),
    );
  const regions = slot?.regionOverrides ?? asset?.regions ?? [];
  const setRegions = (rs: Region[]) => {
    if (slot?.regionOverrides) setSlot({ ...slot, regionOverrides: rs });
    else if (asset) onAsset({ ...asset, regions: rs });
  };
  return (
    <div className="inspector">
      <Field
        label="レイヤー名"
        value={n.name}
        onChange={(v) => set("name", v)}
      />
      <div className="two-col">
        <Check
          label="表示"
          value={n.visible}
          onChange={(v) => set("visible", v)}
        />
        <Check
          label="ロック"
          value={n.locked}
          onChange={(v) => set("locked", v)}
        />
      </div>
      <details open>
        <summary>配置と変形</summary>
        <div className="two-col">
          {(["x", "y", "width", "height"] as const).map((k) => (
            <div key={k}>
              <Num
                label={{ x: "X", y: "Y", width: "幅", height: "高さ" }[k]}
                value={n.frame[k].value}
                onChange={(v) =>
                  set("frame", { ...n.frame, [k]: { ...n.frame[k], value: v } })
                }
              />
              <Select
                label={k + " 単位"}
                value={n.frame[k].unit}
                options={["px", "ratio"]}
                onChange={(v) =>
                  set("frame", { ...n.frame, [k]: { ...n.frame[k], unit: v } })
                }
              />
            </div>
          ))}
        </div>
        <Select
          label="アンカー"
          value={n.frame.anchor}
          options={["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"]}
          onChange={(v) => set("frame", { ...n.frame, anchor: v })}
        />
        <Select
          label="基準領域"
          value={n.frame.relativeTo}
          options={[
            { value: "canvas", label: "キャンバス" },
            { value: "safe", label: "セーフエリア" },
            { value: "parent", label: "親グループ" },
            ...layers
              .filter((l) => l.id !== n.id)
              .map((l) => ({ value: l.id, label: l.name })),
          ]}
          onChange={(v) => set("frame", { ...n.frame, relativeTo: v })}
        />
        <Select
          label="親グループ"
          value={n.parentId}
          options={[
            { value: "", label: "なし" },
            ...layers
              .filter((l) => l.type === "group" && l.id !== n.id)
              .map((l) => ({ value: l.id, label: l.name })),
          ]}
          onChange={(v) => set("parentId", v)}
        />
        <div className="two-col">
          <Num
            label="回転 °"
            value={n.rotation}
            onChange={(v) => set("rotation", v)}
          />
          <Num
            label="不透明度"
            min={0}
            max={1}
            value={n.opacity}
            onChange={(v) => set("opacity", v)}
          />
        </div>
        <Select
          label="ブレンド"
          value={n.blend}
          options={[
            "normal",
            "multiply",
            "screen",
            "overlay",
            "soft-light",
            "hard-light",
            "darken",
            "lighten",
            "add",
          ]}
          onChange={(v) => set("blend", v)}
        />
      </details>
      <details open>
        <summary>色・形状・装飾</summary>
        <Field label="塗り色" value={n.fill} onChange={(v) => set("fill", v)} />
        <Select
          label="マスク形状"
          value={n.mask}
          options={["none", "rect", "ellipse", "rounded"]}
          onChange={(v) => set("mask", v)}
        />
        <div className="two-col">
          {n.radii.map((r, i) => (
            <Num
              key={i}
              label={["左上角丸", "右上角丸", "右下角丸", "左下角丸"][i]}
              value={r}
              min={0}
              onChange={(v) => {
                const a = clone(n.radii);
                a[i] = v;
                set("radii", a);
              }}
            />
          ))}
        </div>
        <Select
          label="装飾プリセット"
          value={n.decoration}
          options={["none", "paper", "torn", "plastic", "tape"]}
          onChange={(v) => set("decoration", v)}
        />
        {n.type === "icon" && (
          <Select
            label="アイコングリフ"
            value={n.icon}
            options={[
              "star",
              "heart",
              "flower",
              "moon",
              "sparkles",
              "diamond",
              "circle",
              "check",
            ]}
            onChange={(v) => set("icon", v)}
          />
        )}
      </details>
      {["text", "label"].includes(n.type) && (
        <details open>
          <summary>文字と文字単位装飾</summary>
          <label className="field">
            <span>表示テキスト（変数使用可）</span>
            <textarea
              aria-label="表示テキスト"
              value={n.text}
              onChange={(e) => set("text", e.target.value)}
            />
          </label>
          <Field
            label="フォント名"
            value={n.fontFamily}
            onChange={(v) => set("fontFamily", v)}
          />
          <Select
            label="インポートフォント"
            value={n.fontAssetId}
            options={[
              { value: "", label: "システム指定" },
              ...assets
                .filter((a) => a.kind === "font")
                .map((a) => ({ value: a.id, label: a.name })),
            ]}
            onChange={(v) => set("fontAssetId", v)}
          />
          <div className="two-col">
            <Num
              label="文字サイズ"
              value={n.fontSize}
              min={0.001}
              onChange={(v) => set("fontSize", v)}
            />
            <Select
              label="文字サイズ単位"
              value={n.fontUnit}
              options={["px", "ratio"]}
              onChange={(v) => set("fontUnit", v)}
            />
            <Num
              label="ウェイト"
              value={n.fontWeight}
              min={100}
              max={900}
              onChange={(v) => set("fontWeight", v)}
            />
            <Num
              label="字間"
              value={n.letterSpacing}
              onChange={(v) => set("letterSpacing", v)}
            />
            <Num
              label="行間倍率"
              value={n.lineHeight}
              min={0.1}
              max={10}
              onChange={(v) => set("lineHeight", v)}
            />
            <Num
              label="余白"
              value={n.padding}
              min={0}
              max={200}
              onChange={(v) => set("padding", v)}
            />
          </div>
          <Select
            label="文字揃え"
            value={n.align}
            options={["left", "center", "right"]}
            onChange={(v) => set("align", v)}
          />
          <Field
            label="文字背景色（空欄で解除）"
            value={n.textBackground}
            onChange={(v) => set("textBackground", v)}
          />
          <Field
            label="一文字の円背景色（空欄で解除）"
            value={n.charBackground}
            onChange={(v) => set("charBackground", v)}
          />
          <Field
            label="縁取り色"
            value={n.stroke}
            onChange={(v) => set("stroke", v)}
          />
          <Num
            label="縁取り幅"
            min={0}
            max={100}
            value={n.strokeWidth}
            onChange={(v) => set("strokeWidth", v)}
          />
          <Num
            label="文字の影"
            min={0}
            max={100}
            value={n.shadow}
            onChange={(v) => set("shadow", v)}
          />
          <p className="hint">
            塗り色を gradient
            にするとグラデーション。字形の欠落は目視でも確認してください。
          </p>
        </details>
      )}
      {["gradient", "text", "label"].includes(n.type) && (
        <details>
          <summary>グラデーション</summary>
          <Select
            label="グラデーション種別"
            value={n.gradient.kind}
            options={["linear", "radial"]}
            onChange={(v) => set("gradient", { ...n.gradient, kind: v })}
          />
          <Num
            label="グラデーション角度"
            value={n.gradient.angle}
            onChange={(v) => set("gradient", { ...n.gradient, angle: v })}
          />
          <Check
            label="グラデーション反転"
            value={n.gradient.reverse}
            onChange={(v) => set("gradient", { ...n.gradient, reverse: v })}
          />
          {n.gradient.stops.map((s, i) => (
            <div className="two-col" key={i}>
              <Field
                label={"色 " + (i + 1)}
                type="color"
                value={s.color}
                onChange={(v) =>
                  set("gradient", {
                    ...n.gradient,
                    stops: n.gradient.stops.map((a, j) =>
                      i === j ? { ...a, color: v } : a,
                    ),
                  })
                }
              />
              <Num
                label={"位置 " + (i + 1)}
                min={0}
                max={1}
                value={s.offset}
                onChange={(v) =>
                  set("gradient", {
                    ...n.gradient,
                    stops: n.gradient.stops.map((a, j) =>
                      i === j ? { ...a, offset: v } : a,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            onClick={() =>
              set("gradient", {
                ...n.gradient,
                stops: [
                  ...n.gradient.stops,
                  { offset: 0.5, color: "#ffffff", alpha: 1 },
                ],
              })
            }
          >
            カラーストップを追加
          </button>
        </details>
      )}
      {["image", "split"].includes(n.type) && (
        <>
          <details open>
            <summary>画像スロット</summary>
            <Select
              label="編集する画像"
              value={String(slotIndex)}
              options={n.slots.map((s, i) => ({
                value: String(i),
                label: `画像 ${i + 1} / ${assets.find((a) => a.id === s.assetId)?.name ?? "未選択"}`,
              }))}
              onChange={(v) => setSlotIndex(Number(v))}
            />
            <button
              onClick={() => {
                set("slots", [
                  ...n.slots,
                  {
                    id: uid(),
                    assetId: assets.find((a) => a.kind !== "font")?.id ?? "",
                    placement: placement(),
                    reference: placement(),
                    fit: "cover",
                    effects: [],
                  },
                ]);
                setSlotIndex(n.slots.length);
              }}
            >
              画像スロットを追加
            </button>
            {slot && (
              <>
                <Select
                  label="参照素材"
                  value={slot.assetId}
                  options={[
                    { value: "", label: "素材を選択" },
                    ...assets
                      .filter((a) => a.kind !== "font")
                      .map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  onChange={(v) => setSlot({ ...slot, assetId: v })}
                />
                <Select
                  label="画像フィット"
                  value={slot.fit}
                  options={["cover", "contain"]}
                  onChange={(v) => setSlot({ ...slot, fit: v })}
                />
                <div className="two-col">
                  {(["x", "y", "scale", "rotation"] as const).map((k) => (
                    <Num
                      key={k}
                      label={"画像 " + k}
                      value={slot.placement[k]}
                      min={k === "scale" ? 0.01 : undefined}
                      onChange={(v) =>
                        setSlot({
                          ...slot,
                          placement: { ...slot.placement, [k]: v },
                        })
                      }
                    />
                  ))}
                </div>
                <button
                  onClick={() =>
                    setSlot({ ...slot, reference: clone(slot.placement) })
                  }
                >
                  この配置を元構図に記録
                </button>
                <button
                  onClick={() => {
                    set(
                      "slots",
                      n.slots.filter((_, i) => i !== slotIndex),
                    );
                    setSlotIndex(0);
                  }}
                >
                  スロットを削除
                </button>
                <h4>この画像だけの効果</h4>
                <Effects
                  value={slot.effects}
                  onChange={(v) => setSlot({ ...slot, effects: v })}
                />
              </>
            )}
          </details>
          {n.type === "split" && (
            <details open>
              <summary>分割線（幾何と装飾）</summary>
              {n.lines.map((l, i) => (
                <div className="inset" key={l.id}>
                  <Num
                    label={"分割線 " + (i + 1) + " 角度"}
                    value={l.angle}
                    onChange={(v) =>
                      set(
                        "lines",
                        n.lines.map((a, j) =>
                          i === j ? { ...a, angle: v } : a,
                        ),
                      )
                    }
                  />
                  <div className="two-col">
                    {([0, 1] as const).map((k) => (
                      <Num
                        key={k}
                        label={"分割線 " + (i + 1) + (k === 0 ? " X" : " Y")}
                        value={l.position[k]}
                        onChange={(v) => {
                          const pos = clone(l.position);
                          pos[k] = v;
                          set(
                            "lines",
                            n.lines.map((a, j) =>
                              i === j ? { ...a, position: pos } : a,
                            ),
                          );
                        }}
                      />
                    ))}
                  </div>
                  <Check
                    label={"分割線 " + (i + 1) + " 境界を表示"}
                    value={l.decorative}
                    onChange={(v) =>
                      set(
                        "lines",
                        n.lines.map((a, j) =>
                          i === j ? { ...a, decorative: v } : a,
                        ),
                      )
                    }
                  />
                  <Field
                    label={"境界色 " + (i + 1)}
                    type="color"
                    value={l.color}
                    onChange={(v) =>
                      set(
                        "lines",
                        n.lines.map((a, j) =>
                          i === j ? { ...a, color: v } : a,
                        ),
                      )
                    }
                  />
                  <Num
                    label={"境界幅 " + (i + 1)}
                    min={0}
                    max={100}
                    value={l.width}
                    onChange={(v) =>
                      set(
                        "lines",
                        n.lines.map((a, j) =>
                          i === j ? { ...a, width: v } : a,
                        ),
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      set(
                        "lines",
                        n.lines.filter((_, j) => i !== j),
                      )
                    }
                  >
                    分割線を削除
                  </button>
                </div>
              ))}
              <button
                disabled={n.lines.length >= 6}
                onClick={() =>
                  set("lines", [
                    ...n.lines,
                    {
                      id: uid(),
                      angle: 60,
                      position: [0.5, 0.5],
                      enabled: true,
                      decorative: true,
                      color: "#ffffff",
                      width: 5,
                      opacity: 1,
                    },
                  ])
                }
              >
                分割線を追加
              </button>
              <JsonEditor
                label="セルの画像割当て"
                value={n.cellOwners}
                onApply={(v) =>
                  set("cellOwners", nodeSchema.shape.cellOwners.parse(v))
                }
              />
            </details>
          )}
          {asset && slot && (
            <details open>
              <summary>構図アシスト・keep / avoid</summary>
              <RegionEditor
                asset={asset}
                regions={regions}
                getBlob={getBlob}
                onChange={setRegions}
              />
              <p className="hint">
                領域は元画像の0〜1座標。共通領域と配置固有の目標を分けられます。
              </p>
              <Check
                label="配置専用の領域・アンカー"
                value={!!slot.regionOverrides}
                onChange={(v) =>
                  setSlot({
                    ...slot,
                    regionOverrides: v ? clone(asset.regions) : undefined,
                  })
                }
              />
              {regions.map((r, i) => (
                <div className="inset" key={r.id}>
                  <Select
                    label={"領域 " + (i + 1)}
                    value={r.type}
                    options={["keep", "avoid"]}
                    onChange={(v) =>
                      setRegions(
                        regions.map((a, j) =>
                          i === j ? { ...a, type: v } : a,
                        ),
                      )
                    }
                  />
                  <Num
                    label={"優先度 " + (i + 1)}
                    value={r.priority}
                    min={0}
                    max={100}
                    onChange={(v) =>
                      setRegions(
                        regions.map((a, j) =>
                          i === j ? { ...a, priority: v } : a,
                        ),
                      )
                    }
                  />
                  <div className="two-col">
                    {([0, 1] as const).map((k) => (
                      <Num
                        key={k}
                        label={"目標 " + (i + 1) + (k === 0 ? " X" : " Y")}
                        value={r.target[k]}
                        onChange={(v) => {
                          const target = clone(r.target);
                          target[k] = v;
                          setRegions(
                            regions.map((a, j) =>
                              i === j ? { ...a, target } : a,
                            ),
                          );
                        }}
                      />
                    ))}
                  </div>
                  <Select
                    label={"退出方向 " + (i + 1)}
                    value={r.exit}
                    options={["left", "right", "top", "bottom"]}
                    onChange={(v) =>
                      setRegions(
                        regions.map((a, j) =>
                          i === j ? { ...a, exit: v } : a,
                        ),
                      )
                    }
                  />
                  <JsonEditor
                    label={"領域ポリゴン " + (i + 1)}
                    value={r.polygon}
                    onApply={(v) =>
                      setRegions(
                        regions.map((a, j) =>
                          i === j
                            ? {
                                ...a,
                                polygon: regionSchema.shape.polygon.parse(v),
                              }
                            : a,
                        ),
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      setRegions(regions.filter((_, j) => j !== i))
                    }
                  >
                    領域を削除
                  </button>
                </div>
              ))}
              <div className="button-row">
                {(["keep", "avoid"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setRegions([
                        ...regions,
                        {
                          id: uid(),
                          type,
                          polygon: [
                            [0.25, 0.25],
                            [0.75, 0.25],
                            [0.75, 0.75],
                            [0.25, 0.75],
                          ],
                          priority: 1,
                          target: [0.5, 0.5],
                          exit: "bottom",
                          anchor: "cc",
                        },
                      ])
                    }
                  >
                    {type}領域を追加
                  </button>
                ))}
              </div>
              <Select
                label="回転探索モード"
                value={n.composition.mode}
                options={[
                  { value: "fixed", label: "角度固定" },
                  { value: "bounded", label: "角度変更を許可" },
                ]}
                onChange={(v) =>
                  set("composition", { ...n.composition, mode: v })
                }
              />
              <Num
                label="許容角度 ±°"
                min={0}
                max={180}
                value={n.composition.maxDelta}
                onChange={(v) =>
                  set("composition", { ...n.composition, maxDelta: v })
                }
              />
              <div className="two-col">
                <Num
                  label="最小倍率"
                  min={0.01}
                  value={n.composition.minScale}
                  onChange={(v) =>
                    set("composition", { ...n.composition, minScale: v })
                  }
                />
                <Num
                  label="最大倍率"
                  min={0.01}
                  value={n.composition.maxScale}
                  onChange={(v) =>
                    set("composition", { ...n.composition, maxScale: v })
                  }
                />
              </div>
              <button className="primary" onClick={onOptimize}>
                自動構図の候補を計算
              </button>
              <button onClick={onRestore}>元の構図へ戻す</button>
            </details>
          )}
        </>
      )}
      {n.type === "particles" && (
        <details open>
          <summary>パーティクル</summary>
          <Select
            label="粒子の種類"
            value={n.particle.kind}
            options={["light", "snow", "petal", "dust", "spark", "polygon"]}
            onChange={(v) => set("particle", { ...n.particle, kind: v })}
          />
          {(
            [
              "seed",
              "count",
              "speed",
              "life",
              "gravity",
              "sway",
              "size",
              "time",
            ] as const
          ).map((k) => (
            <Num
              key={k}
              label={"粒子 " + k}
              value={n.particle[k]}
              onChange={(v) => set("particle", { ...n.particle, [k]: v })}
            />
          ))}
          <Field
            label="粒子色"
            type="color"
            value={n.particle.color}
            onChange={(v) => set("particle", { ...n.particle, color: v })}
          />
        </details>
      )}
      <details open>
        <summary>
          {n.type === "adjustment" ? "下層調整レイヤー" : "全体の非破壊効果"}
        </summary>
        {n.type === "adjustment" && (
          <Select
            label="効果対象"
            value={n.adjustmentTarget}
            options={[
              { value: "", label: "同じグループの下層すべて" },
              ...layers
                .filter((l) => l.parentId === n.parentId && l.id !== n.id)
                .map((l) => ({ value: l.id, label: l.name })),
            ]}
            onChange={(v) => set("adjustmentTarget", v)}
          />
        )}
        <Effects value={n.effects} onChange={(v) => set("effects", v)} />
      </details>
      <JsonEditor
        label="レイヤー全設定"
        value={n}
        onApply={(v) => onChange(nodeSchema.parse(v))}
      />
      <JsonEditor
        label="領域一括設定"
        value={regions}
        onApply={(v) => setRegions(z.array(regionSchema).parse(v))}
      />
    </div>
  );
}
