import { useCallback, useEffect, useRef, useState } from "react";
import {
  Layers,
  SlidersHorizontal,
  ImagePlus,
  Download,
  Undo2,
  Redo2,
  FlaskConical,
  FolderOpen,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import {
  initialWorkspace,
  newProject,
  record,
  clone,
  uid,
  layer,
  m,
  placement,
  profileSchema,
  type Workspace,
  type Project,
  type Layer,
  type Patch,
  type Asset,
  type Profile,
} from "./model";
import {
  applyPatches,
  resolve,
  validateWorkspace,
  History,
  bind,
  filename,
} from "./document";
import { optimize, rect, splitCells, type Candidate } from "./geometry";
import {
  db,
  createBackup,
  readBackup,
  mergeWorkspace,
  download,
} from "./storage";
import { importAsset, extractColors, contrast, webFont } from "./assets";
import {
  diagnosticBundle,
  importDiagnostic,
  diagnostics,
  errorCode,
} from "./diagnostics";
import { StudioRenderer, type RenderReport } from "./renderer";
import { gateConfig, gatePassed, unlock, logout } from "./gate";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { Field, Num, Select, Check, JsonEditor } from "./fields";
import coverage from "./coverage.json";
type Mode = "project" | "template" | "variant";
type Tab =
  | "edit"
  | "library"
  | "assets"
  | "profiles"
  | "export"
  | "settings"
  | "diagnostic";
const typeNames: Record<Layer["type"], string> = {
  shape: "図形",
  text: "テキスト",
  label: "ラベル",
  image: "画像",
  split: "複数画像",
  particles: "パーティクル",
  gradient: "グラデーション",
  adjustment: "調整レイヤー",
  group: "グループ",
  icon: "アイコン",
};
function Gate({ onEnter }: { onEnter: () => void }) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <main className="gate">
      <div className="gate-art">
        <span className="eyebrow">FORMULA / CREATIVE TOOLS</span>
        <h1>
          ひとつの作品から、
          <br />
          いくつもの表情へ。
        </h1>
        <div className="gate-cards">
          <div>
            STUDIO
            <br />
            <b>01</b>
          </div>
          <div>
            制作ノート<span>YOUR NEXT STORY</span>
          </div>
          <div>
            NEW
            <br />
            WORKS
          </div>
        </div>
        <p>
          つくる。整える。届ける。
          <br />
          あなたのための、小さなバナー制作室。
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void unlock(password)
            .then((ok) =>
              ok
                ? onEnter()
                : setError("合言葉が違います。もう一度入力してください。"),
            )
            .catch(() => setError("この環境ではチェックを実行できません。"));
        }}
      >
        <span className="brand-mark">B /</span>
        <h2>Banner Studio</h2>
        <p>制作室に入るための合言葉を入力してください。</p>
        <Field
          label="合言葉"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <button className="primary" type="submit">
          制作室を開く <ChevronRight size={18} />
        </button>
        {error && <p role="alert">{error}</p>}
        <p className="hint">開発用デモの合言葉：banner-demo</p>
        <small>
          これは簡易的な入口です。認証・秘密保護の機能ではなく、公開ソースや配信ファイルは隠せません。
        </small>
      </form>
    </main>
  );
}
export default function App() {
  const [entered, setEntered] = useState(gatePassed());
  return entered ? (
    <Studio
      onLogout={() => {
        logout();
        setEntered(false);
      }}
    />
  ) : (
    <Gate onEnter={() => setEntered(true)} />
  );
}
function Studio({ onLogout }: { onLogout: () => void }) {
  const [w, setW] = useState<Workspace | null>(null),
    current = useRef<Workspace | null>(null),
    history = useRef<History<Workspace> | null>(null),
    generation = useRef(0),
    pending = useRef(new Map<string, Blob>()),
    saveChain = useRef(Promise.resolve()),
    [saveStatus, setSaveStatus] = useState("読込中"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [projectId, setProjectId] = useState(""),
    [profileId, setProfileId] = useState("wide"),
    [templateId, setTemplateId] = useState(""),
    [variantId, setVariantId] = useState(""),
    [mode, setMode] = useState<Mode>("project"),
    [tab, setTab] = useState<Tab>("edit"),
    [selected, setSelected] = useState(""),
    [scope, setScope] = useState<"project" | "profile">("project"),
    [guides, setGuides] = useState(true),
    [mobilePane, setMobilePane] = useState("canvas"),
    [slotIndex, setSlotIndex] = useState(0),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [report, setReport] = useState<RenderReport | null>(null),
    [stage, setStage] = useState("final"),
    [debug, setDebug] = useState(false),
    [navigate, setNavigate] = useState(false),
    [zoom, setZoom] = useState(1),
    [palette, setPalette] = useState<string[]>([]),
    [isolated, setIsolated] = useState(false),
    [exports, setExports] = useState<
      { name: string; blob: Blob; url: string }[]
    >([]),
    [fontURL, setFontURL] = useState(""),
    [fontName, setFontName] = useState("WebFont"),
    [playing, setPlaying] = useState(false),
    [previewTime, setPreviewTime] = useState<number | null>(null),
    [includeAssets, setIncludeAssets] = useState(false);
  const fail = useCallback((error: unknown) => {
    const code = errorCode(error);
    diagnostics.record(
      "APP",
      code,
      current.current?.revision ?? 0,
      {},
      "error",
    );
    setMessage(
      `${code} — 設定・素材・保存状態を確認してください。診断パネルから詳細を確認できます。`,
    );
  }, []);
  useEffect(() => {
    void db
      .load()
      .then((data) => {
        const value = data?.value ?? initialWorkspace();
        generation.current = data?.generation ?? 0;
        current.current = value;
        history.current = new History(value);
        setW(value);
        setProjectId(value.projects[0]?.id ?? "");
        setTemplateId(value.templates[0]?.id ?? "");
        setSaveStatus(data ? "保存済み" : "未保存");
      })
      .catch((e) => {
        fail(e);
        setSaveStatus("保存データ読込失敗：上書きを停止");
      });
  }, [fail]);
  const getBlob = useCallback(
    async (id: string) => pending.current.get(id) ?? (await db.blob(id)),
    [],
  );
  const persist = useCallback(
    (value: Workspace) => {
      if (isolated) {
        setSaveStatus("隔離診断：保存しません");
        return Promise.resolve();
      }
      setSaveStatus("保存中…");
      const batch = new Map(pending.current);
      const next = saveChain.current
        .catch(() => {})
        .then(async () => {
          try {
            generation.current = await db.save(
              value,
              generation.current,
              batch,
            );
            for (const [id, blob] of batch)
              if (pending.current.get(id) === blob) pending.current.delete(id);
            if (current.current === value) setSaveStatus("保存済み");
          } catch (e) {
            setSaveStatus("保存失敗・未保存");
            fail(e);
            throw e;
          }
        });
      saveChain.current = next;
      return next;
    },
    [fail, isolated],
  );
  useEffect(() => {
    if (!w) return;
    const timer = setTimeout(() => {
      void persist(w).catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [w, persist]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "保存済み" && !isolated) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus, isolated]);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const t = setInterval(
      () => setPreviewTime((performance.now() - start) / 1000),
      120,
    );
    return () => clearInterval(t);
  }, [playing]);
  function change(fn: (next: Workspace) => void) {
    if (!current.current) return;
    try {
      const next = clone(current.current);
      fn(next);
      next.revision++;
      const valid = validateWorkspace(next);
      history.current!.commit(valid);
      current.current = valid;
      setW(valid);
      setSaveStatus(isolated ? "隔離診断：保存しません" : "未保存");
      diagnostics.record("UI", "DOCUMENT_EDIT", valid.revision);
    } catch (e) {
      fail(e);
    }
  }
  function undo(redo = false) {
    const next = redo ? history.current!.redo() : history.current!.undo();
    current.current = next;
    setW(next);
    setSaveStatus("未保存");
  }
  if (!w)
    return (
      <main className="loading">
        <h1>Banner Studio</h1>
        <p role="status">{saveStatus}</p>
        {message && <p role="alert">{message}</p>}
      </main>
    );
  const template =
      w.templates.find((t) => t.id === templateId) ?? w.templates[0],
    variant = w.variants.find((v) => v.id === variantId),
    storedProject = w.projects.find((p) => p.id === projectId) ?? w.projects[0];
  let p: Project;
  if (mode === "project") p = storedProject;
  else {
    p = newProject(template);
    p.id = "editor";
    p.createdAt = template.createdAt;
    p.updatedAt = template.updatedAt;
    p.profileIds = w.profiles.map((p) => p.id);
    if (mode === "variant" && variant) p.variantSnapshot = variant;
  }
  if (!p) return <p>プロジェクトがありません。</p>;
  const profile = w.profiles.find((p) => p.id === profileId) ?? w.profiles[0];
  let resolved: ReturnType<typeof resolve>;
  try {
    resolved = resolve(p, profile);
  } catch (e) {
    return (
      <main className="loading">
        <p role="alert">{errorCode(e)}</p>
        <button onClick={() => undo()}>直前の変更を戻す</button>
        <button
          onClick={() => {
            setMode("project");
            setVariantId("");
          }}
        >
          プロジェクトへ戻る
        </button>
      </main>
    );
  }
  const n = resolved.layers.find((n) => n.id === selected);
  const renderProject = clone(p);
  if (previewTime !== null) {
    const anim = resolved.layers
      .filter((n) => n.type === "particles")
      .map((n) => ({
        op: "replace" as const,
        targetId: n.id,
        path: "particle",
        value: { ...n.particle, time: previewTime },
      }));
    renderProject.profilePatches[profile.id] = [
      ...(renderProject.profilePatches[profile.id] ?? []),
      ...anim,
    ];
  }
  function updateProject(fn: (project: Project) => void) {
    change((next) => {
      const target = next.projects.find((a) => a.id === p.id);
      if (!target) throw Error("ERR_PROJECT_MODE");
      fn(target);
      target.revision++;
      target.updatedAt = new Date().toISOString();
    });
  }
  function patch(patches: Patch[]) {
    change((next) => {
      if (mode === "template") {
        const t = next.templates.find((t) => t.id === template.id)!;
        t.layers = applyPatches(t.layers, patches);
        t.revision++;
        t.updatedAt = new Date().toISOString();
      } else if (mode === "variant") {
        const v = next.variants.find((v) => v.id === variantId);
        if (!v) throw Error("ERR_VARIANT_MISSING");
        v.patches.push(...patches);
        v.revision++;
      } else {
        const target = next.projects.find((a) => a.id === p.id)!;
        if (scope === "profile")
          target.profilePatches[profile.id] = [
            ...(target.profilePatches[profile.id] ?? []),
            ...patches,
          ];
        else target.patches.push(...patches);
        target.revision++;
      }
    });
  }
  function edit(next: Layer) {
    const before = resolved.layers.find((l) => l.id === next.id);
    if (!before) return;
    patch(
      (Object.keys(next) as (keyof Layer)[])
        .filter(
          (k) =>
            k !== "id" &&
            k !== "type" &&
            JSON.stringify(next[k]) !== JSON.stringify(before[k]),
        )
        .map((k) => ({
          op: "replace",
          targetId: next.id,
          path: k,
          value: next[k],
        })),
    );
  }
  function add(type: Layer["type"]) {
    const a = layer(type, typeNames[type]);
    if (type === "image" || type === "split") {
      a.slots = [
        {
          id: uid(),
          assetId: w!.assets.find((a) => a.kind !== "font")?.id ?? "",
          placement: placement(),
          reference: placement(),
          fit: "cover",
          effects: [],
        },
      ];
      a.frame.height = m(0.6, "ratio", "height");
      if (type === "split")
        a.lines = [
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
        ];
    }
    patch([{ op: "add", targetId: a.id, value: a }]);
    setSelected(a.id);
    setSlotIndex(0);
    setMobilePane("properties");
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function files(list: FileList | null, library = false) {
    if (!list) return;
    await run(async () => {
      const results = [];
      for (const file of Array.from(list))
        results.push(await importAsset(file, library));
      const additions: Asset[] = [];
      for (const result of results) {
        if (
          w!.assets.some((a) => a.sha256 === result.asset.sha256) ||
          additions.some((a) => a.sha256 === result.asset.sha256)
        )
          continue;
        additions.push(result.asset);
        pending.current.set(result.asset.blobKey, result.blob);
      }
      change((next) => next.assets.push(...additions));
      setMessage(
        `${additions.length}点の素材を取り込みました。バックアップ同梱は素材の許諾設定で選択してください。`,
      );
    });
  }
  async function exportPNG(formal = false) {
    await run(async () => {
      if (mode !== "project") throw Error("ERR_PROJECT_MODE");
      await saveChain.current.catch(() => {});
      const exportP = clone(p),
        output: { name: string; blob: Blob; url: string }[] = [],
        used = new Set<string>();
      if (formal && !exportP.serialConfirmed)
        exportP.serial = w!.series[exportP.series] ?? 1;
      const engine = new StudioRenderer();
      try {
        await engine.init(document.createElement("canvas"));
        for (const id of p.profileIds) {
          const prof = w!.profiles.find((q) => q.id === id);
          if (!prof) throw Error("ERR_PROFILE_MISSING");
          setMessage(`${prof.name} を生成中…`);
          await engine.render(exportP, prof, w!.assets, getBlob);
          const blob = await engine.png();
          output.push({
            name: filename(bind(exportP.filename, exportP, prof), used),
            blob,
            url: URL.createObjectURL(blob),
          });
        }
        if (!output.length) throw Error("ERR_EXPORT_EMPTY");
        if (formal && !p.serialConfirmed) {
          const next = clone(current.current!);
          const pr = next.projects.find((q) => q.id === p.id)!;
          pr.serial = exportP.serial;
          pr.serialConfirmed = true;
          next.series[pr.series] = pr.serial + 1;
          next.revision++;
          await persist(next);
          history.current!.commit(next);
          current.current = next;
          setW(next);
        }
        exports.forEach((e) => URL.revokeObjectURL(e.url));
        setExports(output);
        setMessage(
          `${output.length}件のPNGを生成しました。下の保存リンクをご利用ください。`,
        );
        diagnostics.record("EXPORT", "EXPORT_SUCCESS", p.revision, {
          count: output.length,
        });
      } catch (e) {
        output.forEach((o) => URL.revokeObjectURL(o.url));
        throw e;
      } finally {
        engine.destroy();
      }
    });
  }
  function optimizeSelected() {
    if (!n) return;
    void run(async () => {
      const slot = n.slots[slotIndex],
        a = w!.assets.find((a) => a.id === slot?.assetId);
      if (!a || !slot) throw Error("ERR_ASSET_MISSING");
      const box = resolved.boxes[n.id],
        cells = splitCells(box.width, box.height, n.lines);
      const cell = cells.find(
        (c, i) =>
          (n.cellOwners[c.id] ?? n.slots[i % n.slots.length]?.id) === slot.id,
      );
      const results = optimize(
        slot.reference,
        a.width,
        a.height,
        box.width,
        box.height,
        cell?.polygon ?? rect(box.width, box.height),
        slot.regionOverrides ?? a.regions,
        n.composition,
        [p.templateSnapshot.width, p.templateSnapshot.height],
        slot.fit,
      );
      setCandidates(results);
      setMessage("候補を計算しました。採用する候補を選んでください。");
    });
  }
  const panelTitle =
    mode === "template"
      ? "テンプレート原本を編集中"
      : mode === "variant"
        ? "バリエーション差分を編集中"
        : scope === "profile"
          ? "この出力先だけを編集"
          : "この投稿だけを編集";
  return (
    <div className="studio">
      <header className="topbar">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("edit");
          }}
        >
          B<span>/</span>
          <strong>Banner Studio</strong>
          <small>制作室</small>
        </a>
        <div className="top-actions">
          <span
            className={
              "save-state " + (saveStatus.includes("失敗") ? "error" : "")
            }
            role="status"
          >
            ● {saveStatus}
          </span>
          <button
            aria-label="元に戻す"
            onClick={() => undo()}
            disabled={!history.current?.past.length || busy}
          >
            <Undo2 size={18} />
          </button>
          <button
            aria-label="やり直す"
            onClick={() => undo(true)}
            disabled={!history.current?.future.length || busy}
          >
            <Redo2 size={18} />
          </button>
          <button className="primary" onClick={() => setTab("export")}>
            <Download size={17} /> 書き出し
          </button>
          <button aria-label="ログアウト" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <nav className="main-nav">
        {(
          [
            ["edit", "制作", SlidersHorizontal],
            ["library", "プロジェクト", FolderOpen],
            ["assets", "素材", ImagePlus],
            ["profiles", "出力先", Layers],
            ["settings", "設定", SlidersHorizontal],
            ["diagnostic", "診断", FlaskConical],
          ] as const
        ).map(([id, title, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={17} />
            {title}
          </button>
        ))}
        <span className="nav-note">ブラウザ内に保存 · 実機未検証</span>
      </nav>
      {message && (
        <div className="notice" role="alert">
          {message}
          <button aria-label="通知を閉じる" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {isolated && (
        <div className="notice">
          隔離診断セッション：元データへ保存しません。
          <button onClick={() => location.reload()}>通常作業に戻る</button>
        </div>
      )}
      <fieldset className="workspace-fieldset" disabled={busy}>
        {tab === "edit" && (
          <>
            <div className="projectbar">
              <div>
                <span className="eyebrow">
                  WORKSPACE / {mode.toUpperCase()}
                </span>
                <h1>
                  {mode === "project"
                    ? p.name
                    : mode === "template"
                      ? template.name
                      : variant?.name}
                </h1>
              </div>
              <div className="project-controls">
                <Select
                  label="編集対象"
                  value={mode}
                  options={[
                    { value: "project", label: "投稿プロジェクト" },
                    { value: "template", label: "テンプレート原本" },
                    { value: "variant", label: "バリエーション" },
                  ]}
                  onChange={(v) => {
                    if (v === "variant" && !variantId) {
                      setVariantId(
                        w.variants.find((v) => v.templateId === template.id)
                          ?.id ?? "",
                      );
                    }
                    setMode(v);
                    setSelected("");
                  }}
                />
                {mode === "project" && (
                  <Select
                    label="変更範囲"
                    value={scope}
                    options={[
                      { value: "project", label: "投稿全体" },
                      { value: "profile", label: "この出力先のみ" },
                    ]}
                    onChange={setScope}
                  />
                )}
                <span className="scope-label">{panelTitle}</span>
              </div>
            </div>
            <div className="mobile-tabs">
              {[
                ["layers", "レイヤー"],
                ["canvas", "キャンバス"],
                ["properties", "詳細設定"],
              ].map(([id, label]) => (
                <button
                  className={mobilePane === id ? "active" : ""}
                  key={id}
                  onClick={() => setMobilePane(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={"editor pane-" + mobilePane}>
              <aside className="layers-panel">
                <div className="panel-heading">
                  <h2>レイヤー</h2>
                  <span>{resolved.layers.length}</span>
                </div>
                <div className="layer-list">
                  {[...resolved.layers].reverse().map((l) => (
                    <button
                      key={l.id}
                      className={
                        "layer-row " + (l.id === selected ? "selected" : "")
                      }
                      onClick={() => {
                        setSelected(l.id);
                        setSlotIndex(0);
                        setCandidates([]);
                      }}
                    >
                      <span className="layer-symbol">
                        {l.type === "text"
                          ? "T"
                          : l.type === "image"
                            ? "▧"
                            : l.type === "particles"
                              ? "✦"
                              : "◇"}
                      </span>
                      <span>
                        {l.parentId ? "↳ " : ""}
                        {l.name}
                        <small>
                          {typeNames[l.type]} {l.locked ? "· ロック" : ""}{" "}
                          {!l.visible ? "· 非表示" : ""}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
                <Select
                  label="要素を追加"
                  value=""
                  options={[
                    { value: "", label: "＋ 要素を追加" },
                    ...Object.entries(typeNames).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                  onChange={(v) => {
                    if (v) add(v as Layer["type"]);
                  }}
                />
                {n && (
                  <div className="layer-tools">
                    <button
                      onClick={() => {
                        const c = clone(n);
                        c.id = uid();
                        c.name += " の複製";
                        c.parentId = "";
                        patch([{ op: "add", targetId: c.id, value: c }]);
                        setSelected(c.id);
                      }}
                    >
                      複製
                    </button>
                    <button
                      onClick={() => {
                        patch([{ op: "remove", targetId: n.id }]);
                        setSelected("");
                      }}
                    >
                      削除
                    </button>
                    <button
                      onClick={() =>
                        patch([
                          {
                            op: "move",
                            targetId: n.id,
                            value: Math.min(
                              resolved.layers.length - 1,
                              resolved.layers.findIndex((a) => a.id === n.id) +
                                1,
                            ),
                          },
                        ])
                      }
                    >
                      前面へ
                    </button>
                    <button
                      onClick={() =>
                        patch([
                          {
                            op: "move",
                            targetId: n.id,
                            value: Math.max(
                              0,
                              resolved.layers.findIndex((a) => a.id === n.id) -
                                1,
                            ),
                          },
                        ])
                      }
                    >
                      背面へ
                    </button>
                    <button
                      onClick={() => {
                        const g = layer("group", "グループ");
                        g.frame = {
                          x: m(0),
                          y: m(0),
                          width: m(1),
                          height: m(1, "ratio", "height"),
                          anchor: "tl",
                          relativeTo: "canvas",
                        };
                        patch([
                          { op: "add", targetId: g.id, value: g },
                          {
                            op: "replace",
                            targetId: n.id,
                            path: "parentId",
                            value: g.id,
                          },
                        ]);
                      }}
                    >
                      グループ化
                    </button>
                    <button
                      onClick={() => {
                        const name = prompt("プリセット名", n.name);
                        if (name)
                          change((next) =>
                            next.presets.push({
                              id: uid(),
                              name,
                              node: clone(n),
                            }),
                          );
                      }}
                    >
                      装飾を保存
                    </button>
                  </div>
                )}
                <div className="panel-foot">
                  <strong>原本をそのままに。</strong>
                  <p>投稿の編集はテンプレートへ自動反映されません。</p>
                </div>
              </aside>
              <section className="canvas-panel">
                <div className="canvas-toolbar">
                  <div className="profile-pills">
                    {w.profiles.map((pr) => (
                      <button
                        className={pr.id === profile.id ? "active" : ""}
                        key={pr.id}
                        onClick={() => setProfileId(pr.id)}
                      >
                        {pr.name}
                        <small>
                          {pr.width} × {pr.height}
                        </small>
                      </button>
                    ))}
                  </div>
                  <Check label="ガイド" value={guides} onChange={setGuides} />
                </div>
                <Canvas
                  project={renderProject}
                  profile={profile}
                  assets={w.assets}
                  getBlob={getBlob}
                  selected={selected}
                  onSelect={setSelected}
                  onEdit={edit}
                  guides={guides}
                  stage={stage}
                  onReport={setReport}
                  onError={fail}
                  navigate={navigate}
                  zoom={zoom}
                />
                <div className="canvas-footer">
                  <span>
                    {profile.confidence === "provisional"
                      ? "検証用サイズ · 公式寸法ではありません"
                      : profile.confidence}
                  </span>
                  <div>
                    <Check
                      label="画面移動"
                      value={navigate}
                      onChange={setNavigate}
                    />
                    <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}>
                      −
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(3, zoom + 0.1))}>
                      ＋
                    </button>
                  </div>
                </div>
                {resolved.warnings.length > 0 && (
                  <p className="hint">
                    配置警告 {resolved.warnings.length}
                    件：診断パネルで衝突・はみ出しを確認できます。
                  </p>
                )}
                {mode === "project" && (
                  <div className="quick-input">
                    <div>
                      <span className="eyebrow">QUICK INPUT</span>
                      <h2>今回の作品</h2>
                    </div>
                    <Field
                      label="タイトル"
                      value={p.variables.title ?? ""}
                      onChange={(v) =>
                        updateProject((p) => {
                          p.variables.title = v;
                        })
                      }
                    />
                    <Field
                      label="サブタイトル"
                      value={p.variables.subtitle ?? ""}
                      onChange={(v) =>
                        updateProject((p) => {
                          p.variables.subtitle = v;
                        })
                      }
                    />
                    <Select
                      label="公開ラベル"
                      value={p.variables.visibility ?? ""}
                      options={[
                        { value: "", label: "なし" },
                        ...w.labels
                          .filter((l) => !l.hidden)
                          .map((l) => ({ value: l.name, label: l.name })),
                      ]}
                      onChange={(v) =>
                        updateProject((p) => {
                          p.variables.visibility = v;
                        })
                      }
                    />
                    <Select
                      label="投稿のバリエーション"
                      value={p.variantSnapshot?.id ?? ""}
                      options={[
                        { value: "", label: "ベース" },
                        ...w.variants
                          .filter((v) => v.templateId === p.templateSnapshot.id)
                          .map((v) => ({ value: v.id, label: v.name })),
                      ]}
                      onChange={(v) =>
                        updateProject((p) => {
                          const variant = w.variants.find((a) => a.id === v);
                          if (
                            variant &&
                            variant.templateRevision !==
                              p.templateSnapshot.revision
                          )
                            throw Error("ERR_VARIANT_REVISION");
                          p.variantSnapshot = variant
                            ? clone(variant)
                            : undefined;
                        })
                      }
                    />
                    <label className="upload-button">
                      <ImagePlus size={18} /> 画像を取り込む
                      <input
                        aria-label="画像を取り込む"
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => {
                          void files(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
                {candidates.length > 0 && (
                  <section className="candidate-panel">
                    <h3>構図の候補（採用前）</h3>
                    {candidates.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (n) {
                            const slots = clone(n.slots);
                            slots[slotIndex].placement = c.placement;
                            edit({ ...n, slots });
                            setMessage(
                              "候補を採用しました。Undoまたは元構図への復帰ができます。",
                            );
                          }
                        }}
                      >
                        候補 {i + 1} · 誤差 {c.total.toFixed(3)} ·{" "}
                        {c.placement.rotation.toFixed(1)}°
                        {c.conflict ? " / keep・avoid競合" : ""}
                      </button>
                    ))}
                  </section>
                )}
              </section>
              <aside className="properties-panel">
                <div className="panel-heading">
                  <h2>{n ? "詳細設定" : "制作のヒント"}</h2>
                  <SlidersHorizontal size={17} />
                </div>
                {n ? (
                  <Inspector
                    node={n}
                    assets={w.assets}
                    layers={resolved.layers}
                    onChange={edit}
                    onAsset={(a) =>
                      change((next) => {
                        next.assets = next.assets.map((x) =>
                          x.id === a.id ? a : x,
                        );
                      })
                    }
                    onOptimize={optimizeSelected}
                    onRestore={() => {
                      const slots = clone(n.slots);
                      slots[slotIndex].placement = clone(
                        slots[slotIndex].reference,
                      );
                      edit({ ...n, slots });
                    }}
                    slotIndex={slotIndex}
                    setSlotIndex={setSlotIndex}
                  />
                ) : (
                  <div className="empty-panel">
                    <span>✦</span>
                    <h3>
                      伝えたいことを、
                      <br />
                      あなたらしく。
                    </h3>
                    <p>
                      キャンバスかレイヤーを選ぶと、配置・文字・効果を調整できます。
                    </p>
                    <p>
                      まずは下の「今回の作品」にタイトルを入力してみてください。
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
        {tab === "library" && (
          <main className="page">
            <span className="eyebrow">YOUR COLLECTION</span>
            <h1>プロジェクトとテンプレート</h1>
            <section>
              <h2>投稿プロジェクト</h2>
              <div className="cards">
                {w.projects.map((pr) => (
                  <article key={pr.id}>
                    <span className="card-icon">▤</span>
                    <h3>{pr.name}</h3>
                    <p>{pr.variables.title}</p>
                    <small>
                      {pr.templateSnapshot.name} / {pr.date}
                    </small>
                    <div className="button-row">
                      <button
                        className="primary"
                        onClick={() => {
                          setProjectId(pr.id);
                          setMode("project");
                          setTab("edit");
                          setSelected("");
                        }}
                      >
                        開く
                      </button>
                      <button
                        onClick={() => {
                          const name = prompt("プロジェクト名", pr.name);
                          if (name)
                            change((next) => {
                              next.projects.find((p) => p.id === pr.id)!.name =
                                name;
                            });
                        }}
                      >
                        名前変更
                      </button>
                      <button
                        onClick={() =>
                          change((next) =>
                            next.projects.push({
                              ...clone(pr),
                              ...record(),
                              name: pr.name + " の複製",
                              serialConfirmed: false,
                            }),
                          )
                        }
                      >
                        複製
                      </button>
                      <button
                        disabled={w.projects.length <= 1}
                        onClick={() => {
                          if (
                            confirm(
                              "このプロジェクトを削除しますか？ Undoで戻せます。",
                            )
                          )
                            change((next) => {
                              next.projects = next.projects.filter(
                                (p) => p.id !== pr.id,
                              );
                            });
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>テンプレート原本</h2>
              <div className="button-row">
                <button
                  onClick={() => {
                    const name = prompt(
                      "新規テンプレート名",
                      "新しいテンプレート",
                    );
                    if (!name) return;
                    const t = {
                      ...record(),
                      name,
                      width: 1200,
                      height: 630,
                      layers: [
                        layer("gradient", "背景"),
                        layer("text", "タイトル"),
                      ],
                    };
                    change((next) => next.templates.push(t));
                    setTemplateId(t.id);
                    setMode("template");
                    setTab("edit");
                  }}
                >
                  ＋ 新規テンプレート
                </button>
                <button
                  onClick={() => {
                    const name = prompt(
                      "別名保存するテンプレート名",
                      "投稿から作成",
                    );
                    if (name) {
                      const t = {
                        ...record(),
                        name,
                        width: profile.width,
                        height: profile.height,
                        layers: clone(resolved.layers),
                      };
                      change((next) => next.templates.push(t));
                      setTemplateId(t.id);
                    }
                  }}
                >
                  現在のデザインを別名保存
                </button>
              </div>
              <div className="cards">
                {w.templates.map((t) => (
                  <article key={t.id}>
                    <span className="card-icon">◇</span>
                    <h3>{t.name}</h3>
                    <small>
                      revision {t.revision} · {t.layers.length} レイヤー
                    </small>
                    <div className="button-row">
                      <button
                        className="primary"
                        onClick={() => {
                          const project = newProject(t);
                          project.profileIds = w.profiles
                            .slice(0, 3)
                            .map((p) => p.id);
                          change((next) => next.projects.push(project));
                          setProjectId(project.id);
                          setTemplateId(t.id);
                          setMode("project");
                          setSelected("");
                          setTab("edit");
                        }}
                      >
                        このテンプレートで投稿
                      </button>
                      <button
                        onClick={() => {
                          setTemplateId(t.id);
                          setMode("template");
                          setTab("edit");
                          setSelected("");
                        }}
                      >
                        原本を編集
                      </button>
                      <button
                        onClick={() => {
                          const name = prompt("テンプレート名", t.name);
                          if (name)
                            change((next) => {
                              next.templates.find((a) => a.id === t.id)!.name =
                                name;
                            });
                        }}
                      >
                        名前変更
                      </button>
                      <button
                        onClick={() =>
                          change((next) =>
                            next.templates.push({
                              ...clone(t),
                              ...record(),
                              name: t.name + " の複製",
                            }),
                          )
                        }
                      >
                        複製
                      </button>
                      <button
                        disabled={w.templates.length <= 1}
                        onClick={() => {
                          if (
                            confirm(
                              "原本を削除しますか？ 既存投稿のスナップショットは保持されます。",
                            )
                          )
                            change((next) => {
                              next.templates = next.templates.filter(
                                (a) => a.id !== t.id,
                              );
                              next.variants = next.variants.filter(
                                (v) => v.templateId !== t.id,
                              );
                            });
                        }}
                      >
                        削除
                      </button>
                      <button
                        onClick={() => {
                          const name = prompt(
                            "バリエーション名",
                            "新しいバリエーション",
                          );
                          if (name) {
                            const v = {
                              ...record(),
                              name,
                              templateId: t.id,
                              templateRevision: t.revision,
                              patches: [],
                            };
                            change((next) => next.variants.push(v));
                            setVariantId(v.id);
                            setTemplateId(t.id);
                            setMode("variant");
                            setTab("edit");
                          }
                        }}
                      >
                        バリエーションを追加
                      </button>
                    </div>
                    {w.variants
                      .filter((v) => v.templateId === t.id)
                      .map((v) => (
                        <div className="variant-row" key={v.id}>
                          <span>
                            {v.name}
                            {v.templateRevision !== t.revision
                              ? "（原本改訂あり）"
                              : ""}
                          </span>
                          <button
                            onClick={() => {
                              setVariantId(v.id);
                              setTemplateId(t.id);
                              setMode("variant");
                              setTab("edit");
                            }}
                          >
                            差分を編集
                          </button>
                          <button
                            onClick={() => {
                              const name = prompt("バリエーション名", v.name);
                              if (name)
                                change((next) => {
                                  next.variants.find(
                                    (a) => a.id === v.id,
                                  )!.name = name;
                                });
                            }}
                          >
                            名称
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "原本の現在の版へ差分を明示適用します。参照切れは拒否します。",
                                )
                              )
                                change((next) => {
                                  applyPatches(t.layers, v.patches);
                                  next.variants.find(
                                    (a) => a.id === v.id,
                                  )!.templateRevision = t.revision;
                                });
                            }}
                          >
                            再同期
                          </button>
                        </div>
                      ))}
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>保存した装飾</h2>
              {w.presets.length === 0 ? (
                <p>詳細設定から「装飾を保存」を使えます。</p>
              ) : (
                w.presets.map((pre) => (
                  <button
                    key={pre.id}
                    onClick={() => {
                      const l = { ...clone(pre.node), id: uid(), parentId: "" };
                      patch([{ op: "add", targetId: l.id, value: l }]);
                      setTab("edit");
                    }}
                  >
                    {pre.name}を追加
                  </button>
                ))
              )}
            </section>
          </main>
        )}
        {tab === "assets" && (
          <main className="page">
            <span className="eyebrow">LOCAL ASSETS</span>
            <h1>素材ライブラリ</h1>
            <p>
              画像・ロゴ・サイン・フォントはこのブラウザ内だけに保存します。
            </p>
            <label className="upload-button">
              <ImagePlus size={18} /> 素材ファイルを追加
              <input
                aria-label="素材ファイルを追加"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.ttf,.otf,.woff,.woff2"
                onChange={(e) => {
                  void files(e.target.files, true);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="cards">
              {w.assets.map((a) => (
                <article key={a.id}>
                  <span className="card-icon">
                    {a.kind === "font" ? "Aa" : "▧"}
                  </span>
                  <h3>{a.name}</h3>
                  <small>
                    {a.kind} · {a.width} × {a.height} · 版 {a.revision}
                  </small>
                  <Check
                    label="頻用素材に表示"
                    value={a.library}
                    onChange={(v) =>
                      change((next) => {
                        next.assets.find((b) => b.id === a.id)!.library = v;
                      })
                    }
                  />
                  <Field
                    label={"ライセンス " + a.name}
                    value={a.license}
                    onChange={(v) =>
                      change((next) => {
                        next.assets.find((b) => b.id === a.id)!.license = v;
                      })
                    }
                  />
                  <Check
                    label="バックアップへの同梱許諾を確認済み"
                    value={a.redistributable}
                    onChange={(v) =>
                      change((next) => {
                        next.assets.find(
                          (b) => b.id === a.id,
                        )!.redistributable = v;
                      })
                    }
                  />
                  <div className="button-row">
                    {a.kind !== "font" && (
                      <>
                        <button
                          onClick={() => {
                            const l = layer("image", a.name);
                            l.slots = [
                              {
                                id: uid(),
                                assetId: a.id,
                                placement: placement(),
                                reference: placement(),
                                fit: "contain",
                                effects: [],
                              },
                            ];
                            patch([{ op: "add", targetId: l.id, value: l }]);
                            setSelected(l.id);
                            setTab("edit");
                          }}
                        >
                          キャンバスへ配置
                        </button>
                        <button
                          onClick={() =>
                            void run(async () => {
                              const b = await getBlob(a.blobKey);
                              if (!b) throw Error("ERR_ASSET_MISSING");
                              setPalette(await extractColors(b));
                              setMessage(
                                "元画像から主要色を抽出しました。色を選ぶと選択レイヤーの塗りに適用します。",
                              );
                            })
                          }
                        >
                          主要色を抽出
                        </button>
                      </>
                    )}
                  </div>
                  <label className="upload-button">
                    新しい版を追加
                    <input
                      aria-label={"素材更新 " + a.name}
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          void run(async () => {
                            const result = await importAsset(f, a.library);
                            result.asset.previousId = a.id;
                            result.asset.revision = a.revision + 1;
                            pending.current.set(
                              result.asset.blobKey,
                              result.blob,
                            );
                            change((next) => next.assets.push(result.asset));
                            setMessage(
                              "新しい素材版を追加しました。既存の配置は変更していません。参照素材から新しい版を選べます。",
                            );
                          });
                      }}
                    />
                  </label>
                </article>
              ))}
            </div>
            {palette.length > 0 && (
              <section>
                <h2>抽出パレット</h2>
                <div className="palette">
                  {palette.map((color) => (
                    <button
                      key={color}
                      style={{
                        background: color,
                        color:
                          contrast(color, "#ffffff") > 4
                            ? "#ffffff"
                            : "#142524",
                      }}
                      onClick={() => {
                        if (n) {
                          edit({ ...n, fill: color });
                          setMessage("選択レイヤーへ適用しました。");
                        } else
                          setMessage("制作画面でレイヤーを選択してください。");
                      }}
                    >
                      {color}
                      <small>
                        対白 {contrast(color, "#ffffff").toFixed(2)}:1
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </main>
        )}
        {tab === "profiles" && (
          <main className="page">
            <span className="eyebrow">OUTPUT PROFILES</span>
            <h1>出力先とセーフエリア</h1>
            <p>
              初期プリセットは検証用です。サービスの公式サイズ・OGP表示を保証しません。
            </p>
            <button
              onClick={() => {
                const pr = {
                  ...clone(profile),
                  ...record(),
                  name: "カスタム",
                  confidence: "provisional" as const,
                  sourceURL: "",
                  checkedAt: "",
                };
                change((next) => next.profiles.push(pr));
                setProfileId(pr.id);
              }}
            >
              ＋ カスタム出力先
            </button>
            <div className="cards">
              {w.profiles.map((pr) => {
                const update = (values: Partial<Profile>) =>
                  change((next) => {
                    const i = next.profiles.findIndex((p) => p.id === pr.id);
                    next.profiles[i] = profileSchema.parse({
                      ...pr,
                      ...values,
                    });
                  });
                return (
                  <article key={pr.id}>
                    <Field
                      label={"出力先名 " + pr.id}
                      value={pr.name}
                      onChange={(v) => update({ name: v })}
                    />
                    <div className="two-col">
                      <Num
                        label={"幅 " + pr.id}
                        min={1}
                        max={4096}
                        value={pr.width}
                        onChange={(v) => update({ width: v })}
                      />
                      <Num
                        label={"高さ " + pr.id}
                        min={1}
                        max={4096}
                        value={pr.height}
                        onChange={(v) => update({ height: v })}
                      />
                    </div>
                    <Field
                      label={"サービス " + pr.id}
                      value={pr.service}
                      onChange={(v) => update({ service: v })}
                    />
                    <Field
                      label={"用途 " + pr.id}
                      value={pr.purpose}
                      onChange={(v) => update({ purpose: v })}
                    />
                    <Num
                      label={"安全余白比率 " + pr.id}
                      min={0}
                      max={0.45}
                      value={pr.safe}
                      onChange={(v) => update({ safe: v })}
                    />
                    <Check
                      label={"透明背景 " + pr.name}
                      value={pr.transparent}
                      onChange={(v) => update({ transparent: v })}
                    />
                    <Field
                      label={"背景色 " + pr.id}
                      type="color"
                      value={pr.background}
                      onChange={(v) => update({ background: v })}
                    />
                    <Select
                      label={"確認状態 " + pr.id}
                      value={pr.confidence}
                      options={[
                        "provisional",
                        "verified_official",
                        "verified_observed",
                      ]}
                      onChange={(v) => update({ confidence: v })}
                    />
                    <Field
                      label={"根拠URL " + pr.id}
                      value={pr.sourceURL}
                      onChange={(v) => update({ sourceURL: v })}
                    />
                    <Field
                      label={"確認日 " + pr.id}
                      value={pr.checkedAt}
                      type="date"
                      onChange={(v) => update({ checkedAt: v })}
                    />
                    <JsonEditor
                      label={"UI重なり領域 " + pr.id}
                      value={pr.overlays}
                      onApply={(v) =>
                        update({
                          overlays: profileSchema.shape.overlays.parse(v),
                        })
                      }
                    />
                  </article>
                );
              })}
            </div>
          </main>
        )}
        {tab === "export" && (
          <main className="page export-page">
            <span className="eyebrow">READY TO SHARE</span>
            <h1>作品を、届けるかたちに。</h1>
            <p>
              ガイド・選択枠は書き出しません。書き出し前に各サイズの構図をご確認ください。
            </p>
            {mode !== "project" ? (
              <button
                onClick={() => {
                  setMode("project");
                }}
              >
                投稿プロジェクトに切り替える
              </button>
            ) : (
              <>
                <div className="cards">
                  {w.profiles.map((pr) => (
                    <article key={pr.id}>
                      <div
                        className="profile-shape"
                        style={{ aspectRatio: `${pr.width}/${pr.height}` }}
                      >
                        PNG
                      </div>
                      <Check
                        label={pr.name + "を書き出す"}
                        value={p.profileIds.includes(pr.id)}
                        onChange={(v) =>
                          updateProject((p) => {
                            p.profileIds = v
                              ? [...p.profileIds, pr.id]
                              : p.profileIds.filter((id) => id !== pr.id);
                          })
                        }
                      />
                      <small>
                        {pr.width} × {pr.height} / {pr.confidence}
                      </small>
                    </article>
                  ))}
                </div>
                <section className="form-grid">
                  <Field
                    label="ファイル名テンプレート"
                    value={p.filename}
                    onChange={(v) =>
                      updateProject((p) => {
                        p.filename = v;
                      })
                    }
                  />
                  <Field
                    label="日付"
                    type="date"
                    value={p.date}
                    onChange={(v) =>
                      updateProject((p) => {
                        p.date = v;
                      })
                    }
                  />
                  <Field
                    label="タイムゾーン"
                    value={p.timezone}
                    onChange={(v) =>
                      updateProject((p) => {
                        p.timezone = v;
                      })
                    }
                  />
                  <Field
                    label="シリーズ"
                    value={p.series}
                    onChange={(v) =>
                      updateProject((p) => {
                        p.series = v;
                        p.serialConfirmed = false;
                      })
                    }
                  />
                  <Num
                    label="連番"
                    min={0}
                    value={p.serial}
                    onChange={(v) =>
                      updateProject((p) => {
                        p.serial = v;
                        p.serialConfirmed = false;
                      })
                    }
                  />
                  <button
                    onClick={() =>
                      updateProject((p) => {
                        p.serial = w.series[p.series] ?? p.serial + 1;
                        p.serialConfirmed = false;
                      })
                    }
                  >
                    次番号へ進む
                  </button>
                </section>
                <p className="hint">
                  {
                    "{{title}} / {{service}} / {{serial:03}} / {{date:YYYY.MM.DD}}"
                  }{" "}
                  を使用できます。正式出力は全画像の生成成功・保存成功後に採番を確定します。再出力では加算しません。
                </p>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() => void exportPNG(false)}
                  >
                    <Download size={18} /> 一括PNGを生成（試し出力）
                  </button>
                  <button onClick={() => void exportPNG(true)}>
                    正式出力・採番を確定
                  </button>
                </div>
                {exports.length > 0 && (
                  <section>
                    <h2>生成した画像</h2>
                    <div className="cards">
                      {exports.map((e) => (
                        <article key={e.name}>
                          <img
                            className="export-image"
                            src={e.url}
                            alt={e.name}
                          />
                          <a className="button" href={e.url} download={e.name}>
                            {e.name} を保存
                          </a>
                          <button
                            onClick={() =>
                              void run(async () => {
                                const f = new File([e.blob], e.name, {
                                  type: "image/png",
                                });
                                if (navigator.canShare?.({ files: [f] }))
                                  await navigator.share({ files: [f] });
                                else {
                                  window.open(e.url, "_blank", "noopener");
                                  setMessage(
                                    "画像を新しいタブで開きました。画像を長押しして保存できます。",
                                  );
                                }
                              })
                            }
                          >
                            共有 / 画像を開く
                          </button>
                        </article>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        void run(async () => {
                          const files: Record<string, Uint8Array> = {};
                          for (const e of exports)
                            files[e.name] = new Uint8Array(
                              await e.blob.arrayBuffer(),
                            );
                          files["manifest.json"] = strToU8(
                            JSON.stringify({
                              version: 1,
                              engine: "PixiJS8",
                              files: exports.map((e) => e.name),
                              guides: false,
                              generatedAt: new Date().toISOString(),
                            }),
                          );
                          download(
                            new Blob([new Uint8Array(zipSync(files)).buffer], {
                              type: "application/zip",
                            }),
                            "banner-exports.zip",
                          );
                        })
                      }
                    >
                      PNGをZIPにまとめて保存
                    </button>
                  </section>
                )}
              </>
            )}
          </main>
        )}
        {tab === "settings" && (
          <main className="page">
            <span className="eyebrow">SETTINGS & BACKUP</span>
            <h1>設定とバックアップ</h1>
            <section>
              <h2>ブラウザ内保存・端末間移行</h2>
              <p>
                自動保存はバックアップではありません。iPhoneとiPad間ではZIPを書き出し、別端末で読み込んでください。
              </p>
              <Check
                label="許諾済み素材をバックアップへ含める"
                value={includeAssets}
                onChange={setIncludeAssets}
              />
              <button
                className="primary"
                onClick={() =>
                  void run(async () =>
                    download(
                      await createBackup(w, getBlob, includeAssets),
                      "banner-backup.zip",
                    ),
                  )
                }
              >
                バックアップZIPを保存
              </button>
              <label className="upload-button">
                バックアップを検証・取り込み
                <input
                  aria-label="バックアップを取り込む"
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void run(async () => {
                        const parsed = await readBackup(f);
                        if (
                          !confirm(
                            `${parsed.workspace.projects.length}件を別IDで追加します。欠損・省略素材 ${parsed.missing.length}件。元データは保持します。取り込みますか？`,
                          )
                        )
                          return;
                        const merged = mergeWorkspace(
                          current.current!,
                          parsed.workspace,
                          parsed.blobs,
                        );
                        for (const [id, blob] of merged.blobs)
                          pending.current.set(id, blob);
                        await persist(merged.workspace);
                        history.current!.commit(merged.workspace);
                        current.current = merged.workspace;
                        setW(merged.workspace);
                        setMessage("バックアップを別IDで取り込みました。");
                      });
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="button-row">
                <button
                  onClick={() =>
                    void run(async () => {
                      const s = await navigator.storage?.estimate();
                      setMessage(
                        s
                          ? `保存容量 推計 ${Math.round((s.usage ?? 0) / 1024 / 1024)} MB / ${Math.round((s.quota ?? 0) / 1024 / 1024)} MB`
                          : "このブラウザでは容量推計を取得できません。",
                      );
                    })
                  }
                >
                  保存容量を確認
                </button>
                <button
                  onClick={() =>
                    void run(async () =>
                      setMessage(
                        (await navigator.storage?.persist())
                          ? "永続保存の要求が許可されました。ZIPバックアップも続けてください。"
                          : "永続保存は許可されませんでした。ZIPバックアップを利用してください。",
                      ),
                    )
                  }
                >
                  永続保存を要求
                </button>
                <button
                  onClick={() =>
                    void run(async () => {
                      await persist(w);
                      setMessage("保存しました。");
                    })
                  }
                >
                  今すぐ保存
                </button>
              </div>
            </section>
            <section>
              <h2>ラベル管理</h2>
              {w.labels.map((l) => (
                <div className="label-setting" key={l.id}>
                  <Field
                    label={"ラベル " + l.id}
                    value={l.name}
                    onChange={(v) =>
                      change((next) => {
                        next.labels.find((a) => a.id === l.id)!.name = v;
                      })
                    }
                  />
                  <Check
                    label={l.name + " を一覧に表示"}
                    value={!l.hidden}
                    onChange={(v) =>
                      change((next) => {
                        next.labels.find((a) => a.id === l.id)!.hidden = !v;
                      })
                    }
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  change((next) =>
                    next.labels.push({
                      id: uid(),
                      name: "独自ラベル",
                      hidden: false,
                      color: "#e5b979",
                      icon: "star",
                    }),
                  )
                }
              >
                独自ラベルを追加
              </button>
            </section>
            <section>
              <h2>Webフォント（任意の外部通信）</h2>
              <p>
                HTTPSのフォントファイルURLを指定します。取得先にアクセスしますが、作品本文は送信しません。クエリ付きURLは受け付けません。端末フォントの全自動列挙は行いません。
              </p>
              <Field
                label="フォントファイルURL"
                value={fontURL}
                onChange={setFontURL}
              />
              <Field
                label="Webフォント名"
                value={fontName}
                onChange={setFontName}
              />
              <button
                onClick={() => {
                  if (
                    confirm(
                      `フォントファイルを ${fontURL} から取得します。利用許諾を確認しましたか？`,
                    )
                  )
                    void run(async () => {
                      await webFont(fontURL, fontName);
                      setMessage(
                        "フォントをこのセッションに読み込みました。永続利用はフォントファイルのインポートを使用してください。",
                      );
                    });
                }}
              >
                通信先を確認してフォントを取得
              </button>
            </section>
            <section>
              <h2>簡易ゲート・公開</h2>
              <p>
                ゲート {gateConfig.enabled ? "有効" : "無効"}
                。本物の認証ではありません。合言葉の変更・ゲート無効化はビルド設定で管理します。公開は別途承認が必要です。
              </p>
              <p>
                外部ホスティング・クラウド同期・自動送信は使用していません。
              </p>
            </section>
          </main>
        )}
        {tab === "diagnostic" && (
          <main className="page">
            <span className="eyebrow">DIAGNOSTICS</span>
            <h1>状態を確かめる</h1>
            <Check
              label="診断ログを有効にする"
              value={debug}
              onChange={(v) => {
                diagnostics.enabled = v;
                setDebug(v);
              }}
            />
            <div className="button-row">
              <button
                onClick={() =>
                  void run(async () => {
                    const fixture = initialWorkspace(),
                      engine = new StudioRenderer();
                    try {
                      validateWorkspace(fixture);
                      await engine.init(document.createElement("canvas"));
                      await engine.render(
                        fixture.projects[0],
                        fixture.profiles[0],
                        [],
                        async () => undefined,
                      );
                      const png = await engine.png();
                      setMessage(
                        `自己診断：スキーマ・WebGL描画・PNG生成 ${png.size} bytes 成功。DB・実機操作は別試験です。`,
                      );
                    } finally {
                      engine.destroy();
                    }
                  })
                }
              >
                自己診断（ダミーデータ）
              </button>
              <button
                onClick={() =>
                  download(
                    diagnosticBundle(p, profile),
                    "banner.diagnostic.zip",
                  )
                }
              >
                素材なし診断ZIPを保存
              </button>
              <label className="upload-button">
                隔離再現を開く
                <input
                  aria-label="診断ZIPを読み込む"
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void run(async () => {
                        await saveChain.current.catch(() => {});
                        const value = await importDiagnostic(f);
                        setIsolated(true);
                        current.current = value;
                        history.current = new History(value);
                        setW(value);
                        setProjectId(value.projects[0].id);
                        setProfileId(value.profiles[0].id);
                        setMode("project");
                        setSelected("");
                        setTab("edit");
                        setMessage(
                          "匿名構造を隔離表示します。素材・本文・効果の完全再現ではありません。",
                        );
                      });
                  }}
                />
              </label>
              <button
                onClick={() => {
                  diagnostics.record(
                    "STORAGE",
                    "ERR_DB_QUOTA",
                    p.revision,
                    { simulated: true },
                    "error",
                  );
                  setMessage(
                    "ERR_DB_QUOTA（診断表示のみの模擬。実DBは変更していません）",
                  );
                }}
              >
                エラー表示を模擬
              </button>
            </div>
            <p className="hint">
              診断ZIPは寸法・種別などの匿名構造のみ。作品・本文・名前・素材は含めません。詳細効果を含む完全再現／素材同梱診断は未完です。
            </p>
            <div className="diagnostic-grid">
              <section>
                <h2>状態・保存</h2>
                <pre>
                  {JSON.stringify(
                    {
                      app: "0.1.0-integrated",
                      schema: w.schemaVersion,
                      revision: w.revision,
                      profile: profile.id,
                      selected,
                      mode,
                      scope,
                      save: saveStatus,
                      fonts: document.fonts.status,
                      viewport: [innerWidth, innerHeight],
                      pixelRatio: devicePixelRatio,
                      device: "実機未検証",
                      gpuMemory: "測定不可",
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
              <section>
                <h2>レンダリング</h2>
                <Select
                  label="描画段階"
                  value={stage}
                  options={["source", "imageFX", "clip", "decoration", "final"]}
                  onChange={(v) => {
                    setStage(v);
                    setTab("edit");
                  }}
                />
                <pre>{JSON.stringify(report, null, 2)}</pre>
                <p>
                  estimatedBytesは画像テクスチャの概算。GPU総量の実測ではありません。
                </p>
              </section>
              <section>
                <h2>レイヤー・出所</h2>
                <pre>
                  {JSON.stringify(
                    {
                      boxes: resolved.boxes,
                      origins: resolved.origins,
                      warnings: resolved.warnings,
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
              <section>
                <h2>構図候補</h2>
                <pre>{JSON.stringify(candidates, null, 2)}</pre>
              </section>
              <section>
                <h2>ログ</h2>
                <pre>{JSON.stringify(diagnostics.events, null, 2)}</pre>
                <button
                  onClick={() =>
                    download(
                      new Blob(
                        [
                          diagnostics.events
                            .map((e) => JSON.stringify(e))
                            .join("\n"),
                        ],
                        { type: "application/x-ndjson" },
                      ),
                      "diagnostic-logs.jsonl",
                    )
                  }
                >
                  ログを保存
                </button>
              </section>
            </div>
            <section>
              <h2>機能実装状態</h2>
              <p>
                自動試験と実機確認を区別しています。全要件の受入完了を意味しません。
              </p>
              <div className="coverage-list">
                {coverage.map((r) => (
                  <div key={r.id}>
                    <code>{r.id}</code>
                    <span>{r.name}</span>
                    <small>{r.status}</small>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}
      </fieldset>
      <footer className="app-footer">
        <span>Banner Studio / integrated development</span>
        <span>ブラウザ内保存 + ZIPバックアップ</span>
        <button onClick={() => setTab("diagnostic")}>診断を開く</button>
      </footer>
      {tab === "edit" && (
        <div className="animation-bar">
          <button
            onClick={() => {
              setPlaying(!playing);
              if (playing) setPreviewTime(null);
            }}
          >
            {playing ? "粒子プレビュー停止" : "粒子を動かす"}
          </button>
          {previewTime !== null && (
            <button
              onClick={() => {
                const time = previewTime;
                setPlaying(false);
                setPreviewTime(null);
                patch(
                  resolved.layers
                    .filter((n) => n.type === "particles")
                    .map((n) => ({
                      op: "replace",
                      targetId: n.id,
                      path: "particle",
                      value: { ...n.particle, time },
                    })),
                );
              }}
            >
              この時刻 {previewTime.toFixed(1)}秒を採用
            </button>
          )}
          <small>保存・出力には採用した時刻を使用します。</small>
        </div>
      )}
    </div>
  );
}
