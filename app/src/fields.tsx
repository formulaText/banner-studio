import { useState } from "react";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step = "any",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Num({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Field
      label={label}
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(v) => {
        const n = Number(v);
        if (
          Number.isFinite(n) &&
          (min === undefined || n >= min) &&
          (max === undefined || n <= max)
        )
          onChange(n);
      }}
    />
  );
}
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          return (
            <option key={v} value={v}>
              {typeof o === "string" ? o : o.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function JsonEditor({
  label,
  value,
  onApply,
}: {
  label: string;
  value: unknown;
  onApply: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null),
    [error, setError] = useState("");
  return (
    <details>
      <summary>{label}（詳細JSON）</summary>
      <textarea
        aria-label={label + " JSON"}
        rows={10}
        value={draft ?? JSON.stringify(value, null, 2)}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        onClick={() => {
          try {
            onApply(JSON.parse(draft ?? JSON.stringify(value)));
            setDraft(null);
            setError("");
          } catch {
            setError("形式または値が不正です。変更を適用していません。");
          }
        }}
      >
        JSONを検証して適用
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
