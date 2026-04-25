"use client";
import { useState } from "react";

interface VerseInputProps {
  onSubmit: (data: {
    verses: string[];
    surah: string;
    surahNumber: number;
    verseNumbers: number[];
    language: "ar" | "fr" | "both";
  }) => void;
  loading: boolean;
}

export default function VerseInput({ onSubmit, loading }: VerseInputProps) {
  const [surah, setSurah] = useState("");
  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [verseStart, setVerseStart] = useState<number>(1);
  const [verseEnd, setVerseEnd] = useState<number>(1);
  const [manualVerses, setManualVerses] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [language, setLanguage] = useState<"ar" | "fr" | "both">("ar");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let verses: string[] = [];
    let verseNumbers: number[] = [];

    if (useManual) {
      verses = manualVerses
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
      verseNumbers = verses.map((_, i) => verseStart + i);
    } else {
      // Placeholder — user pastes verse text per number range
      const count = Math.max(1, verseEnd - verseStart + 1);
      verses = Array.from({ length: count }, (_, i) => `[الآية ${verseStart + i}]`);
      verseNumbers = Array.from({ length: count }, (_, i) => verseStart + i);
    }

    if (verses.length === 0 || verses.length > 10) return;

    onSubmit({
      verses,
      surah: surah || `السورة ${surahNumber}`,
      surahNumber,
      verseNumbers,
      language,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto space-y-6"
      dir="rtl"
    >
      {/* Surah selector */}
      <div className="space-y-2">
        <label
          className="block font-arabic text-sm"
          style={{ color: "var(--gold-dark)" }}
        >
          اسم السورة ورقمها
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={surah}
            onChange={(e) => setSurah(e.target.value)}
            placeholder="مثال: الفاتحة"
            className="flex-1 px-4 py-3 rounded-lg font-arabic text-base"
            style={{
              background: "var(--surface, var(--cream-dark))",
              border: "1px solid var(--border, var(--gold-dark))",
              color: "var(--ink)",
            }}
            dir="rtl"
          />
          <input
            type="number"
            min={1}
            max={114}
            value={surahNumber}
            onChange={(e) => setSurahNumber(Number(e.target.value))}
            placeholder="رقم"
            className="w-20 px-3 py-3 rounded-lg text-center"
            style={{
              background: "var(--surface, var(--cream-dark))",
              border: "1px solid var(--border, var(--gold-dark))",
              color: "var(--ink)",
            }}
          />
        </div>
      </div>

      {/* Input mode toggle */}
      <div className="flex gap-4 items-center">
        <span className="font-arabic text-sm" style={{ color: "var(--text-muted)" }}>
          طريقة الإدخال:
        </span>
        <button
          type="button"
          onClick={() => setUseManual(false)}
          className="px-3 py-1.5 rounded-full text-sm font-arabic transition-all"
          style={{
            background: !useManual ? "var(--gold)" : "transparent",
            color: !useManual ? "#fff" : "var(--text-muted)",
            border: "1px solid var(--gold)",
          }}
        >
          نطاق الآيات
        </button>
        <button
          type="button"
          onClick={() => setUseManual(true)}
          className="px-3 py-1.5 rounded-full text-sm font-arabic transition-all"
          style={{
            background: useManual ? "var(--gold)" : "transparent",
            color: useManual ? "#fff" : "var(--text-muted)",
            border: "1px solid var(--gold)",
          }}
        >
          نص الآيات مباشرة
        </button>
      </div>

      {!useManual ? (
        <div className="space-y-2">
          <label
            className="block font-arabic text-sm"
            style={{ color: "var(--gold-dark)" }}
          >
            نطاق الآيات (من — إلى)
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              min={1}
              value={verseStart}
              onChange={(e) => setVerseStart(Number(e.target.value))}
              className="w-24 px-3 py-3 rounded-lg text-center"
              style={{
                background: "var(--surface, var(--cream-dark))",
                border: "1px solid var(--border, var(--gold-dark))",
                color: "var(--ink)",
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>—</span>
            <input
              type="number"
              min={verseStart}
              max={verseStart + 9}
              value={verseEnd}
              onChange={(e) => setVerseEnd(Number(e.target.value))}
              className="w-24 px-3 py-3 rounded-lg text-center"
              style={{
                background: "var(--surface, var(--cream-dark))",
                border: "1px solid var(--border, var(--gold-dark))",
                color: "var(--ink)",
              }}
            />
            <span className="font-arabic text-sm" style={{ color: "var(--text-muted)" }}>
              (حد أقصى 10 آيات)
            </span>
          </div>
          <p
            className="font-arabic text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            ملاحظة: ستحتاج إلى توفير نصوص التفسير في مجلد data/tafsir/ للحصول على أفضل النتائج
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label
            className="block font-arabic text-sm"
            style={{ color: "var(--gold-dark)" }}
          >
            الآيات (سطر واحد لكل آية — حتى 10 آيات)
          </label>
          <textarea
            value={manualVerses}
            onChange={(e) => setManualVerses(e.target.value)}
            rows={5}
            placeholder="أدخل كل آية في سطر مستقل&#10;مثال:&#10;بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ&#10;الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"
            className="w-full px-4 py-3 rounded-lg font-arabic text-lg leading-loose resize-none"
            style={{
              background: "var(--surface, var(--cream-dark))",
              border: "1px solid var(--border, var(--gold-dark))",
              color: "var(--ink)",
              direction: "rtl",
            }}
            dir="rtl"
          />
          <div className="flex items-center gap-3">
            <label
              className="font-arabic text-sm"
              style={{ color: "var(--gold-dark)" }}
            >
              رقم الآية الأولى:
            </label>
            <input
              type="number"
              min={1}
              value={verseStart}
              onChange={(e) => setVerseStart(Number(e.target.value))}
              className="w-20 px-3 py-2 rounded-lg text-center"
              style={{
                background: "var(--surface, var(--cream-dark))",
                border: "1px solid var(--border, var(--gold-dark))",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>
      )}

      {/* Language selector */}
      <div className="space-y-2">
        <label
          className="block font-arabic text-sm"
          style={{ color: "var(--gold-dark)" }}
        >
          لغة التدبر
        </label>
        <div className="flex gap-3">
          {(
            [
              { value: "ar", label: "عربي فقط", labelFr: "Arabe" },
              { value: "fr", label: "فرنسي فقط", labelFr: "Français" },
              { value: "both", label: "عربي + فرنسي", labelFr: "Bilingue" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLanguage(opt.value)}
              className="flex-1 px-3 py-2 rounded-lg font-arabic text-sm transition-all"
              style={{
                background: language === opt.value ? "var(--gold)" : "transparent",
                color: language === opt.value ? "#fff" : "var(--text-muted)",
                border: "1px solid var(--gold-dark)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl font-arabic text-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, var(--gold-dark), var(--gold))",
          color: "#fff",
          letterSpacing: "0.05em",
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="loading-dot">•</span>
            <span
              className="loading-dot"
              style={{ animationDelay: "0.2s" }}
            >
              •
            </span>
            <span
              className="loading-dot"
              style={{ animationDelay: "0.4s" }}
            >
              •
            </span>
            <span>جارٍ التدبر...</span>
          </span>
        ) : (
          "بدء التدبّر ✦"
        )}
      </button>
    </form>
  );
}
