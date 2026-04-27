"use client";
import { useState } from "react";
import { parseBahoussText, type BahoussVerse } from "@/lib/bahouss-parser";

interface BahoussInputProps {
  onVersesSelected: (verses: BahoussVerse[]) => void;
  initialVerses?: BahoussVerse[];
}

export default function BahoussInput({ onVersesSelected, initialVerses }: BahoussInputProps) {
  const hasInitial = (initialVerses?.length ?? 0) > 0;
  const [raw, setRaw] = useState("");
  const [verses, setVerses] = useState<BahoussVerse[]>(initialVerses ?? []);
  const [checked, setChecked] = useState<Set<number>>(
    new Set((initialVerses ?? []).map(v => v.index))
  );
  const [parsed, setParsed] = useState(hasInitial);
  const [error, setError] = useState("");

  function handleParse() {
    if (!raw.trim()) return;
    const result = parseBahoussText(raw);
    if (result.length === 0) {
      setError("لم يُتعرَّف على أي آية. تحقق من تنسيق النص.");
      return;
    }
    setError("");
    const allIdx = new Set(result.map(v => v.index));
    setVerses(result);
    setChecked(allIdx);
    setParsed(true);
    onVersesSelected(result);
  }

  function toggle(idx: number) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      const selected = verses.filter(v => next.has(v.index));
      onVersesSelected(selected);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === verses.length) {
      setChecked(new Set());
      onVersesSelected([]);
    } else {
      const allIdx = new Set(verses.map(v => v.index));
      setChecked(allIdx);
      onVersesSelected(verses);
    }
  }

  function handleClear() {
    setRaw("");
    setVerses([]);
    setChecked(new Set());
    setParsed(false);
    setError("");
    onVersesSelected([]);
  }

  const checkedCount = checked.size;
  const totalCount = verses.length;

  if (!parsed) {
    return (
      <div className="bahouss-input" dir="rtl">
        <textarea
          className="textarea-field"
          style={{ minHeight: 100, fontSize: 13, direction: "rtl" }}
          value={raw}
          onChange={e => { setRaw(e.target.value); setError(""); }}
          placeholder="ألصق هنا نتائج البحث من تطبيق باحوث..."
          dir="rtl"
        />
        {error && (
          <div style={{ color: "var(--gold)", fontSize: 12, marginTop: 4 }}>{error}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <button
            type="button"
            className="lang-pill"
            style={{ fontFamily: "var(--f-ar)" }}
            onClick={handleParse}
            disabled={!raw.trim()}
          >
            تحليل
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bahouss-input" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button type="button" className="lang-pill" style={{ fontSize: 12 }} onClick={toggleAll}>
          {checkedCount === totalCount ? "إلغاء الكل" : "تحديد الكل"}
        </button>
        <span style={{ fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--f-ar)" }}>
          {checkedCount} / {totalCount} آية محددة
        </span>
        <button type="button" className="lang-pill" style={{ fontSize: 12 }} onClick={handleClear}>
          مسح
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
        {verses.map(v => {
          const isChecked = checked.has(v.index);
          const truncated = v.text.length > 80 ? v.text.slice(0, 80) + "..." : v.text;
          return (
            <label
              key={v.index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 6,
                background: isChecked ? "var(--gold-wash)" : "var(--paper-2)",
                cursor: "pointer",
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(v.index)}
                style={{ marginTop: 3, flexShrink: 0, accentColor: "var(--gold)" }}
              />
              <span style={{ flex: 1, fontFamily: "var(--f-ar)", fontSize: 13 }}>{truncated}</span>
              <span style={{
                flexShrink: 0,
                fontSize: 11,
                color: "var(--gold-ink)",
                background: "var(--gold-wash)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "1px 5px",
                fontFamily: "var(--f-ar)",
                whiteSpace: "nowrap",
              }}>
                {v.surahName}:{v.ayah}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
