"use client";
import { useState } from "react";
import type { TafsirSource } from "@/hooks/useTadabbur";

interface Props {
  tafsirs: TafsirSource[];
}

export default function TafsirSources({ tafsirs }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="tafsir-sources no-print">
      <button
        className="tafsir-sources-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="tafsir-sources-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span>مصادر التفسير المُستخدَمة</span>
          <span className="tafsir-sources-count">{tafsirs.length}</span>
        </div>
        <svg
          className={`tafsir-sources-chevron${open ? " up" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="tafsir-sources-body">
          {tafsirs.map(t => (
            <div key={t.name} className="tafsir-entry">
              <button
                className="tafsir-entry-head"
                onClick={() => setExpanded(e => ({ ...e, [t.name]: !e[t.name] }))}
              >
                <span className="tafsir-entry-name">{t.labelAr}</span>
                <svg
                  className={`tafsir-sources-chevron${expanded[t.name] ? " up" : ""}`}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              {expanded[t.name] && (
                <div className="tafsir-entry-content" dir="rtl">
                  {t.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
