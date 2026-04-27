"use client";
import React, { useEffect, useRef, useState } from "react";
import type { TafsirSource } from "@/hooks/useTadabbur";
import type { BahoussVerse } from "@/lib/bahouss-parser";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  done: boolean;
  tafsirs?: TafsirSource[];
  crossReferences?: BahoussVerse[];
}

interface Section {
  key: string;
  num: string;
  ar: string;
  content: string;
}

interface ParsedMajlis {
  index: number;
  title: string;
  sections: Section[];
}

const SECTION_DEFS = [
  { key: "s1", num: "١", ar: "كلمات الابتلاء",   patterns: [/كلمات الابتلاء/, /الكلمات المُبتلى/] },
  { key: "s2", num: "٢", ar: "البيان العامّ",      patterns: [/البيان العام/] },
  { key: "s3", num: "٣", ar: "الهدى المنهجيّ",     patterns: [/الهدى المنهاج/] },
  { key: "s4", num: "٤", ar: "مَسلك التَّخلُّق",   patterns: [/مسلك التخلق/] },
];

// ── Parsers ────────────────────────────────────────────────────────────────

function parseSections(text: string): Section[] {
  const positions: { pos: number; def: typeof SECTION_DEFS[0] }[] = [];
  for (const def of SECTION_DEFS) {
    for (const pattern of def.patterns) {
      const idx = text.search(new RegExp(`\\*\\*[١٢٣٤1-4]\\s*[-–]\\s*${pattern.source}`));
      if (idx >= 0) { positions.push({ pos: idx, def }); break; }
    }
  }
  if (positions.length === 0) return [];
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p, i) => {
    const start = p.pos;
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    const chunk = text.slice(start, end);
    const headerEnd = chunk.indexOf("\n");
    const body = headerEnd >= 0 ? chunk.slice(headerEnd + 1).trim() : chunk;
    return { key: p.def.key, num: p.def.num, ar: p.def.ar, content: body };
  });
}

function parseMajalis(text: string): ParsedMajlis[] {
  // Match: **المجلس X: ...** OR ## المجلس X: ... OR ### المجلس X: ...
  const MAJLIS_RE = /(?:\*\*المجلس\s+[^\n*]+?\*\*|#{1,3}\s*المجلس\s+[^\n]+)/g;
  const matches: { pos: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = MAJLIS_RE.exec(text)) !== null) {
    const title = m[0].replace(/^\*\*|\*\*$/g, "").replace(/^#{1,3}\s*/, "").trim();
    matches.push({ pos: m.index, title });
  }

  if (matches.length === 0) {
    const sections = parseSections(text);
    if (sections.length === 0) return [];
    return [{ index: 1, title: "", sections }];
  }

  return matches.map((match, i) => {
    const chunkStart = match.pos;
    const chunkEnd = i + 1 < matches.length ? matches[i + 1].pos : text.length;
    const chunk = text.slice(chunkStart, chunkEnd);
    const lineEnd = chunk.indexOf("\n");
    const rawBody = lineEnd >= 0 ? chunk.slice(lineEnd + 1) : "";
    // Strip French summaries and horizontal rules
    const body = rawBody
      .replace(/---\n?Résumé en français[\s\S]*?(?=\n---|\n\*\*المجلس|\n##|$)/gi, "")
      .replace(/^---\s*$/gm, "");
    return { index: i + 1, title: match.title, sections: parseSections(body) };
  });
}

// ── Formatters ─────────────────────────────────────────────────────────────

const STANDALONE_BOLD = /^\*\*([^*\n]+)\*\*:?$/;

function inlineFmt(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/﴿([^﴾]+)﴾/g, `<span class="quran-inline">﴿$1﴾</span>`);
}

function formatBody(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.split(/\n\n+/).map(p => {
    p = p.trim();
    if (!p) return "";
    if (STANDALONE_BOLD.test(p)) {
      return `<h3 class="body-heading">${p.replace(STANDALONE_BOLD, "$1")}</h3>`;
    }
    const lines = p.split("\n");
    if (lines.length > 1 && lines.every(l => /^[•\-]/.test(l.trim()))) {
      return `<ul>${lines.map(l => `<li>${inlineFmt(l.replace(/^[•\-]\s*/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p>${inlineFmt(p.replace(/\n/g, "<br/>"))}</p>`;
  }).join("");
}

// ── Sources panel ──────────────────────────────────────────────────────────

function renderSources(
  tafsirs: TafsirSource[],
  expanded: Record<string, boolean>,
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
) {
  return (
    <div id="s-sources" className="tafsir-sources no-print">
      <div className="tafsir-sources-label" style={{ padding: "18px 20px 12px", borderBottom: "1px solid var(--border)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span>مصادر التفسير المُستخدَمة</span>
        <span className="tafsir-sources-count">{tafsirs.length}</span>
      </div>
      <div className="tafsir-sources-body">
        {tafsirs.map(t => (
          <div key={t.name} className="tafsir-entry">
            <button
              className="tafsir-entry-head"
              onClick={() => setExpanded(e => ({ ...e, [t.name]: !e[t.name] }))}
            >
              <span className="tafsir-entry-name">{t.labelAr}</span>
              <svg className={`tafsir-sources-chevron${expanded[t.name] ? " up" : ""}`}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            {expanded[t.name] && (
              <div className="tafsir-entry-content" dir="rtl">{t.content}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cross-references panel ─────────────────────────────────────────────────

function renderCrossRefs(verses: BahoussVerse[]) {
  return (
    <div id="s-crossrefs" className="tafsir-sources no-print">
      <div className="tafsir-sources-label" style={{ padding: "18px 20px 12px", borderBottom: "1px solid var(--line)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>الآيات المرجعية المُستخدَمة</span>
        <span className="tafsir-sources-count">{verses.length}</span>
      </div>
      <div className="tafsir-sources-body">
        {verses.map(v => (
          <div key={`${v.surah}-${v.ayah}`} className="tafsir-entry">
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 12, color: "var(--gold-ink)",
                  background: "var(--gold-wash)", border: "1px solid var(--line)",
                  borderRadius: 4, padding: "1px 7px",
                  fontFamily: "var(--f-ar)", whiteSpace: "nowrap",
                }}>
                  {v.surahName} : {v.ayah}
                </span>
                {v.morphResult && (
                  <span style={{
                    fontSize: 11, color: "var(--ink-3)",
                    fontFamily: "var(--f-ar)", fontStyle: "italic",
                  }}>
                    {v.morphResult}
                  </span>
                )}
              </div>
              <div dir="rtl" style={{
                fontFamily: "var(--f-ar)", fontSize: 15, lineHeight: 1.9,
                color: "var(--ink)",
              }}>
                {v.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StreamingText({ text, isStreaming, done, tafsirs, crossReferences }: StreamingTextProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [activeSection, setActiveSection] = useState("s1");
  const [activeMajlisIdx, setActiveMajlisIdx] = useState(1);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sourcesExpanded, setSourcesExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isStreaming) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [text, isStreaming]);

  useEffect(() => {
    pillRefs.current[activeMajlisIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeMajlisIdx]);

  if (!text && !isStreaming) return null;

  if (isStreaming) {
    return (
      <div className="reading-stream fade-up">
        <div dangerouslySetInnerHTML={{ __html: formatBody(text) }} />
        <span className="caret" />
        <div ref={endRef} />
      </div>
    );
  }

  const majalis = parseMajalis(text);
  const hasSources   = done && tafsirs && tafsirs.length > 0;
  const hasCrossRefs = done && crossReferences && crossReferences.length > 0;

  if (majalis.length === 0) {
    return (
      <div className="fade-up">
        <div className="reading-stream">
          <div dangerouslySetInnerHTML={{ __html: formatBody(text) }} />
        </div>
        {hasSources   && renderSources(tafsirs!, sourcesExpanded, setSourcesExpanded)}
        {hasCrossRefs && renderCrossRefs(crossReferences!)}
      </div>
    );
  }

  // Build anchor map: sectionKey → list of DOM IDs across all مجالس
  const anchorMap: Record<string, string[]> = {};
  for (const maj of majalis) {
    for (const sec of maj.sections) {
      if (!anchorMap[sec.key]) anchorMap[sec.key] = [];
      anchorMap[sec.key].push(`m${maj.index}-${sec.key}`);
    }
  }

  const multiMajlis = majalis.length > 1;
  const currentMajlis = majalis.find(m => m.index === activeMajlisIdx) ?? majalis[0];

  function jumpToSection(sectionKey: string) {
    document.getElementById(`sec-${sectionKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(sectionKey);
  }

  function jumpToMajlis(idx: number) {
    setActiveMajlisIdx(idx);
    setActiveSection("s1");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <nav className="section-nav fade-up">
        {/* Barre 1 — pills + flèches (multi seulement) */}
        {multiMajlis && (
          <div className="nav-row nav-row-majlis">
            <button className="nav-arrow" onClick={() => pillsRef.current?.scrollBy({ left: -140, behavior: "smooth" })}>‹</button>
            <div className="pills-track" ref={pillsRef}>
              {majalis.map(maj => {
                const label = maj.title ? maj.title.replace(/^المجلس\s+\S+\s*:\s*/, "") : "";
                return (
                  <button
                    key={maj.index}
                    ref={el => { pillRefs.current[maj.index] = el; }}
                    className={`sec-tab${activeMajlisIdx === maj.index ? " active" : ""}`}
                    onClick={() => jumpToMajlis(maj.index)}
                  >
                    <span className="num">{maj.index}</span>
                    {label ? label.slice(0, 14) + (label.length > 14 ? "…" : "") : `المجلس ${maj.index}`}
                  </button>
                );
              })}
            </div>
            <button className="nav-arrow" onClick={() => pillsRef.current?.scrollBy({ left: 140, behavior: "smooth" })}>›</button>
          </div>
        )}

        {/* Barre 2 — 4 modules + sources */}
        <div className="nav-row nav-row-sections">
          {SECTION_DEFS.filter(def => (multiMajlis ? currentMajlis : majalis[0])?.sections.some(s => s.key === def.key)).map(def => (
            <button
              key={def.key}
              className={`sec-tab${activeSection === def.key ? " active" : ""}`}
              onClick={() => jumpToSection(def.key)}
            >
              <span className="num">{def.num}</span>
              {def.ar}
            </button>
          ))}

          {hasSources && (
            <button
              className={`sec-tab${activeSection === "s-sources" ? " active" : ""}`}
              onClick={() => {
                setActiveSection("s-sources");
                document.getElementById("s-sources")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              المصادر
            </button>
          )}

          {hasCrossRefs && (
            <button
              className={`sec-tab${activeSection === "s-crossrefs" ? " active" : ""}`}
              onClick={() => {
                setActiveSection("s-crossrefs");
                document.getElementById("s-crossrefs")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              آيات مرجعية
            </button>
          )}
        </div>
      </nav>

      <div key={currentMajlis.index} className="majlis-view fade-up">
        {currentMajlis.sections.map(sec => (
          <article
            key={sec.key}
            id={`sec-${sec.key}`}
            className={`section-card${collapsed[`${currentMajlis.index}-${sec.key}`] ? " collapsed" : ""}`}
          >
            <header className="section-head">
              <div className="section-num">{sec.num}</div>
              <div className="section-titles">
                <div className="section-ar">{sec.ar}</div>
              </div>
              <button
                className="section-toggle"
                aria-label="Plier"
                onClick={() => setCollapsed(c => ({ ...c, [`${currentMajlis.index}-${sec.key}`]: !c[`${currentMajlis.index}-${sec.key}`] }))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </header>
            <div className="section-body" dangerouslySetInnerHTML={{ __html: formatBody(sec.content) }} />
          </article>
        ))}

        {hasSources   && renderSources(tafsirs!, sourcesExpanded, setSourcesExpanded)}
        {hasCrossRefs && renderCrossRefs(crossReferences!)}
      </div>
    </>
  );
}
