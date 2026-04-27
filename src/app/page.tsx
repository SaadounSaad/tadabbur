"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import VerseInput from "@/components/VerseInput";
import BahoussInput from "@/components/BahoussInput";
import StreamingText from "@/components/StreamingText";
import ThemeToggle from "@/components/ThemeToggle";
import { useTadabbur, type SubmitData, type Depth, type TafsirSource } from "@/hooks/useTadabbur";
import { generateMockTadabbur } from "@/lib/mock-tadabbur";
import type { BahoussVerse } from "@/lib/bahouss-parser";
import { generateAndDownloadDocx } from "@/lib/generate-docx";

interface HistoryItem {
  id: string;
  surah: string;
  verseRange: string;
  depth: Depth;
  timestamp: number;
  text?: string;
  request?: SubmitData;
  resolvedVerses?: string[] | null;
  contextTafsirs?: TafsirSource[];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${d} أيّام`;
}

const DEPTH_LABEL: Record<Depth, string> = { brief: "موجز", medium: "متوسّط", detailed: "مُفصَّل" };


export default function Home() {
  const [screen, setScreen] = useState<"home" | "result">("home");
  const [currentRequest, setCurrentRequest] = useState<SubmitData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [crossReferences, setCrossReferences] = useState<BahoussVerse[]>([]);
  const [density, setDensity] = useState<"airy" | "compact">("airy");
  const [font, setFont] = useState<"amiri" | "naskh">("amiri");

  const historyPanelRef = useRef<HTMLDivElement>(null);

  const handleComplete = useCallback((completedText: string, completedVerses: string[] | null, completedTafsirs: TafsirSource[]) => {
    setCurrentRequest(req => {
      if (!req) return req;
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        surah: req.surah,
        verseRange: req.fromVerse === req.toVerse
          ? String(req.fromVerse)
          : `${req.fromVerse}–${req.toVerse}`,
        depth: req.depth,
        timestamp: Date.now(),
        text: completedText,
        request: req,
        resolvedVerses: completedVerses,
        contextTafsirs: completedTafsirs,
      };
      setHistory(prev => {
        const updated = [item, ...prev].slice(0, 20);
        localStorage.setItem("td:history", JSON.stringify(updated));
        return updated;
      });
      setActiveHistoryId(item.id);
      return req;
    });
  }, []);

  const { text, isStreaming, error, done, resolvedVerses, contextTafsirs, startTadabbur, reset, restore } = useTadabbur(handleComplete);

  useEffect(() => {
    try {
      const h = localStorage.getItem("td:history");
      if (h) {
        const parsed: HistoryItem[] = JSON.parse(h);
        const seen = new Set<string>();
        const deduped = parsed.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        setHistory(deduped);
        if (deduped.length !== parsed.length)
          localStorage.setItem("td:history", JSON.stringify(deduped));
      }
    } catch {
      localStorage.removeItem("td:history");
    }
    const d = localStorage.getItem("td:density") as "airy" | "compact" | null;
    if (d) setDensity(d);
    const f = localStorage.getItem("td:font") as "amiri" | "naskh" | null;
    if (f) setFont(f);
  }, []);

  useEffect(() => {
    document.body.dataset.density = density;
    document.body.dataset.font = font;
    localStorage.setItem("td:density", density);
    localStorage.setItem("td:font", font);
  }, [density, font]);

  // Close history panel on outside click
  useEffect(() => {
    if (!historyOpen) return;
    const handler = (e: MouseEvent) => {
      if (historyPanelRef.current && !historyPanelRef.current.contains(e.target as Node))
        setHistoryOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [historyOpen]);

  function handleSubmit(data: SubmitData) {
    const withRefs: SubmitData = {
      ...data,
      crossReferences: crossReferences.length > 0 ? crossReferences : undefined,
    };
    setCurrentRequest(withRefs);
    startTadabbur(withRefs);
    setScreen("result");
    setHistoryOpen(false);
  }

  function handleEnrich() {
    if (!currentRequest || crossReferences.length === 0) return;
    const enriched: SubmitData = { ...currentRequest, crossReferences };
    setCurrentRequest(enriched);
    startTadabbur(enriched);
  }

  function handleNew() {
    reset();
    setCurrentRequest(null);
    setCrossReferences([]);
    setScreen("home");
  }

  function deleteHistoryItem(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Supprimer cet élément de l'historique ?")) return;
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem("td:history", JSON.stringify(updated));
      return updated;
    });
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      handleNew();
    }
  }

  function handleMockTest(n: number) {
    const surah = "البقرة";
    const from = 1;
    const to = from + n - 1;
    const mockText = generateMockTadabbur(surah, from, to);
    const mockRequest: SubmitData = {
      verses: Array.from({ length: n }, (_, i) => `[آية ${from + i}]`),
      surah,
      surahNumber: 2,
      verseNumbers: Array.from({ length: n }, (_, i) => from + i),
      fromVerse: from,
      toVerse: to,
      depth: "medium",
      tafsirs: [],
    };
    setCurrentRequest(mockRequest);
    restore(mockText, null, []);
    setScreen("result");
  }

  const downloadText = useCallback(() => {
    if (!text) return;
    let content = text;

    if (contextTafsirs && contextTafsirs.length > 0) {
      content += "\n\n" + "═".repeat(40) + "\n";
      content += "ملحق ١ — مصادر التفسير المُستخدَمة\n";
      content += "═".repeat(40) + "\n";
      for (const src of contextTafsirs) {
        content += `\n【 ${src.labelAr} 】\n\n${src.content}\n\n${"─".repeat(30)}\n`;
      }
    }

    const refs = currentRequest?.crossReferences;
    if (refs && refs.length > 0) {
      content += "\n" + "═".repeat(40) + "\n";
      content += "ملحق ٢ — الآيات المرجعية\n";
      content += "═".repeat(40) + "\n";
      for (const v of refs) {
        content += `\nسورة ${v.surahName} · آية ${v.ayah}`;
        if (v.morphResult) content += ` — ${v.morphResult}`;
        content += `\n﴿${v.text}﴾\n`;
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tadabbur-${currentRequest?.surah || "quran"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [text, currentRequest, contextTafsirs]);

  const verseLabel = currentRequest
    ? `${currentRequest.surah} · ${currentRequest.fromVerse}${currentRequest.fromVerse !== currentRequest.toVerse ? `–${currentRequest.toVerse}` : ""}`
    : "";

  return (
    <>
      <div className="app">
        {/* ======== TOPBAR ======== */}
        <div className="topbar">
          {/* Brand */}
          <button className="brand-btn" onClick={handleNew} aria-label="Accueil">
            <div className="brand-mark-sm">ت</div>
            <span className="brand-name-sm">تدبّر</span>
          </button>

          {/* Breadcrumb */}
          <div className="bc">
            <span style={{ cursor: "pointer" }} onClick={handleNew}>الرئيسيّة</span>
            {screen === "result" && currentRequest && (
              <>
                <span className="sep">›</span>
                <span>{currentRequest.surah}</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="topbar-actions">
            {/* History button */}
            <div style={{ position: "relative" }} ref={historyPanelRef}>
              <button
                className={`icon-btn${historyOpen ? " active" : ""}`}
                aria-label="Historique"
                onClick={() => { setHistoryOpen(o => !o); setTweaksOpen(false); }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {history.length > 0 && (
                  <span className="history-badge-dot">{history.length}</span>
                )}
              </button>

              {/* History dropdown */}
              {historyOpen && (
                <div className="history-panel">
                  <div className="history-panel-head" dir="rtl">
                    <span style={{ fontFamily: "var(--f-ar)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>السِّجلّ</span>
                    <button
                      className="side-btn primary"
                      style={{ padding: "5px 12px", fontSize: 12 }}
                      onClick={() => { handleNew(); setHistoryOpen(false); }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      جديد
                    </button>
                  </div>

                  {history.length === 0 ? (
                    <div className="history-empty" dir="rtl">لا يوجد سِجلٌّ بعد</div>
                  ) : (
                    <div className="history-list">
                      {history.map(item => (
                        <div
                          key={item.id}
                          className={`history-item${activeHistoryId === item.id ? " active" : ""}`}
                          onClick={() => {
                            setActiveHistoryId(item.id);
                            setHistoryOpen(false);
                            if (item.text && item.request) {
                              setCurrentRequest(item.request);
                              restore(item.text, item.resolvedVerses, item.contextTafsirs);
                              setScreen("result");
                            } else if (item.request) {
                              setCurrentRequest(item.request);
                              startTadabbur(item.request);
                              setScreen("result");
                            }
                          }}
                        >
                          <div className="history-title">{item.surah} · {item.verseRange}</div>
                          <div className="history-meta">
                            <span>{timeAgo(item.timestamp)}</span>
                            <span className="history-badge">{DEPTH_LABEL[item.depth]}</span>
                          </div>
                          <button
                            className="history-delete"
                            aria-label="Supprimer"
                            onClick={(e) => deleteHistoryItem(item.id, e)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <ThemeToggle />

            <button
              className={`icon-btn${tweaksOpen ? " active" : ""}`}
              aria-label="Paramètres"
              onClick={() => { setTweaksOpen(o => !o); setHistoryOpen(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ======== MAIN ======== */}
        <main className="main">
          {/* ======== SCREEN: HOME ======== */}
          {screen === "home" && (
            <section>
              <div className="home-hero">
                <div className="eyebrow">أداةٌ لتدبّر القرآن الكريم</div>
                <h1 className="home-title">تَدَبَّر</h1>
                <div className="home-title-en">على نهج الشيخ فريد الأنصاريّ</div>
                <p className="home-sub">
                  اختر آيةً أو مقطعًا قرآنيًّا، فيقدّم لك تدبّرٌ تحليلًا مُنهجيًّا
                  على ضوء منهج الشيخ فريد الأنصاري — رحمه الله.
                </p>
              </div>
              <div className="form-card">
                <VerseInput onSubmit={handleSubmit} loading={isStreaming} />
              </div>

              <div className="form-card" style={{ marginTop: 12 }} dir="rtl">
                <div className="field" style={{ margin: 0 }}>
                  <label className="field-label">
                    آيات مرجعية
                    <span style={{ color: "var(--ink-3)", fontWeight: 400, marginRight: 6, fontSize: 11 }}>
                      ألصق نتائج البحث من تطبيق باحوث لإثراء التدبر
                    </span>
                  </label>
                  <BahoussInput
                    onVersesSelected={setCrossReferences}
                    initialVerses={crossReferences.length > 0 ? crossReferences : undefined}
                  />
                </div>
              </div>

              {process.env.NODE_ENV === "development" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button key={n} className="btn-ghost" style={{ fontSize: 12 }} onClick={() => handleMockTest(n)}>
                      mock ×{n}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ======== SCREEN: RESULT ======== */}
          {screen === "result" && (
            <section>
              {error ? (
                <div className="error-card" dir="rtl">
                  <div className="err-title">حدث خطأ</div>
                  <div className="err-msg">{error}</div>
                  <button className="btn-primary" onClick={handleNew}>المحاولة مجدّداً</button>
                </div>
              ) : (
                <>
                  <div className="result-head" dir="rtl">
                    <div>
                      <h1 className="result-title">{verseLabel}</h1>
                      <div className="result-meta">
                        {currentRequest && (
                          <span className="pill gold">
                            {currentRequest.surahNumber}:{currentRequest.fromVerse}
                            {currentRequest.fromVerse !== currentRequest.toVerse && `–${currentRequest.toVerse}`}
                          </span>
                        )}
                        {currentRequest && (
                          <span className="pill">{DEPTH_LABEL[currentRequest.depth]}</span>
                        )}
                        {done && (
                          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--ok)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                            مكتمل
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="head-actions">
                      {done && (
                        <>
                          <button className="btn-ghost" onClick={downloadText} style={{ fontFamily: "var(--f-ar)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            TXT
                          </button>
                          <button
                            className="btn-ghost"
                            style={{ fontFamily: "var(--f-ar)" }}
                            onClick={() => currentRequest && generateAndDownloadDocx(
                              text,
                              currentRequest.surah,
                              currentRequest.fromVerse,
                              currentRequest.toVerse,
                              contextTafsirs?.length ? contextTafsirs : undefined,
                              currentRequest.crossReferences?.length ? currentRequest.crossReferences : undefined,
                            )}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            Word
                          </button>
                        </>
                      )}
                      <button className="btn-ghost" onClick={handleNew} style={{ fontFamily: "var(--f-ar)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        جديد
                      </button>
                    </div>
                  </div>

                  {isStreaming && (
                    <div className="status-banner" dir="rtl">
                      <span className="dot" />
                      <span style={{ fontFamily: "var(--f-ar)", fontSize: 14 }}>يجري الآن توليد التدبّر…</span>
                    </div>
                  )}

                  {currentRequest && (resolvedVerses ?? currentRequest.verses).length > 0 && !(resolvedVerses ?? currentRequest.verses)[0].startsWith("[الآية") && (
                    <div className="verse-card" dir="rtl">
                      <div className="verse-text">
                        {(resolvedVerses ?? currentRequest.verses).map((v, i) => (
                          <span key={i}>
                            {v}
                            <span className="verse-num">{currentRequest.verseNumbers[i]}</span>
                            {i < (resolvedVerses ?? currentRequest.verses).length - 1 ? " " : ""}
                          </span>
                        ))}
                      </div>
                      <div className="verse-foot">
                        <span className="lat">{currentRequest.surah} · {currentRequest.surahNumber}:{currentRequest.fromVerse}
                          {currentRequest.fromVerse !== currentRequest.toVerse && `–${currentRequest.toVerse}`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div dir="rtl">
                    <StreamingText
                      text={text}
                      isStreaming={isStreaming}
                      done={done}
                      tafsirs={contextTafsirs}
                      crossReferences={currentRequest?.crossReferences}
                    />
                  </div>

                  {done && (
                    <>
                      <div className="no-print" style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 36 }} dir="rtl">
                        <button className="btn-ghost" onClick={handleNew} style={{ fontFamily: "var(--f-ar)", fontSize: 14 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                          تدبُّرٌ جديد
                        </button>
                        <button className="btn-ghost" onClick={() => { if (!currentRequest) return; const r: SubmitData = { ...currentRequest, crossReferences: crossReferences.length > 0 ? crossReferences : currentRequest.crossReferences }; setCurrentRequest(r); startTadabbur(r); }} style={{ fontFamily: "var(--f-ar)", fontSize: 14 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9M3 4v5h5"/></svg>
                          إعادة التوليد
                        </button>
                      </div>
                      <div className="no-print" style={{ marginTop: 24, padding: "16px", background: "var(--paper-2)", borderRadius: 10, border: "1px solid var(--line)" }} dir="rtl">
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--f-ar)", color: "var(--ink-2)", marginBottom: 8 }}>
                          آيات مرجعية — تعديل أو إثراء
                        </div>
                        <BahoussInput
                          onVersesSelected={setCrossReferences}
                          initialVerses={currentRequest?.crossReferences}
                        />
                        {crossReferences.length > 0 && (
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontFamily: "var(--f-ar)", fontSize: 13 }}
                              onClick={handleEnrich}
                            >
                              إثراء التدبر
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </main>
      </div>

      {/* ======== TWEAKS PANEL ======== */}
      <div className={`tweaks${tweaksOpen ? " show" : ""}`}>
        <h4 style={{ fontFamily: "var(--f-ar)", fontStyle: "normal" }}>إعداداتٌ سريعة</h4>
        <div className="muted" style={{ fontFamily: "var(--f-ar)" }}>تعديلٌ حيٌّ لمظهر التطبيق.</div>
        <div className="tw-row">
          <span className="tw-label">الخطّ</span>
          <div className="seg">
            {(["amiri", "naskh"] as const).map(f => (
              <button key={f} className={font === f ? "on" : ""} onClick={() => setFont(f)}>
                {f === "amiri" ? "أميري" : "نَسخ"}
              </button>
            ))}
          </div>
        </div>
        <div className="tw-row">
          <span className="tw-label">الكثافة</span>
          <div className="seg">
            {(["airy", "compact"] as const).map(d => (
              <button key={d} className={density === d ? "on" : ""} onClick={() => setDensity(d)}>
                {d === "airy" ? "رحبة" : "مُكثَّفة"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
