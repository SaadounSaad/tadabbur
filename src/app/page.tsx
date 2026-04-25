"use client";
import { useState } from "react";
import VerseInput from "@/components/VerseInput";
import StreamingText from "@/components/StreamingText";
import ThemeToggle from "@/components/ThemeToggle";
import { useTadabbur } from "@/hooks/useTadabbur";

interface SubmitData {
  verses: string[];
  surah: string;
  surahNumber: number;
  verseNumbers: number[];
  language: "ar" | "fr" | "both";
}

export default function Home() {
  const { text, isStreaming, error, done, startTadabbur, reset } =
    useTadabbur();
  const [currentRequest, setCurrentRequest] = useState<SubmitData | null>(
    null
  );

  function handleSubmit(data: SubmitData) {
    setCurrentRequest(data);
    startTadabbur(data);
  }

  function handleReset() {
    reset();
    setCurrentRequest(null);
  }

  const showResult = text || isStreaming || error || done;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--cream)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{
          background: "var(--cream)",
          borderBottom: "1px solid var(--gold-dark)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-arabic text-3xl font-bold"
            style={{ color: "var(--gold)" }}
          >
            تدبّر
          </span>
          <span
            className="hidden sm:block text-sm italic"
            style={{
              color: "var(--text-muted)",
              fontFamily: "'Cormorant Garamond', serif",
            }}
          >
            Tadabbur
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        {!showResult ? (
          /* Landing / Input screen */
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
            {/* Hero */}
            <div className="text-center mb-12 space-y-4">
              <div className="gold-divider max-w-xs mx-auto mb-6">
                <span style={{ color: "var(--gold)", fontSize: "0.75rem" }}>
                  ✦
                </span>
              </div>

              <h1
                className="font-arabic text-6xl sm:text-7xl font-bold"
                style={{ color: "var(--ink)" }}
              >
                تدبّر
              </h1>
              <p
                className="font-arabic text-xl"
                style={{ color: "var(--text-muted)" }}
              >
                أداة التدبر القرآني
              </p>
              <p
                className="text-base italic max-w-md mx-auto leading-relaxed"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "'Cormorant Garamond', serif",
                }}
              >
                Outil de réflexion coranique basé sur la méthodologie de Farid
                Al-Ansari
              </p>

              <div
                className="font-arabic text-sm max-w-lg mx-auto mt-4 leading-loose"
                style={{ color: "var(--text-muted)" }}
                dir="rtl"
              >
                ﴿كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا
                آيَاتِهِ وَلِيَتَذَكَّرَ أُولُو الْأَلْبَابِ﴾
              </div>

              <div className="gold-divider max-w-xs mx-auto mt-6">
                <span style={{ color: "var(--gold)", fontSize: "0.75rem" }}>
                  ✦
                </span>
              </div>
            </div>

            {/* Input form */}
            <div
              className="w-full max-w-2xl rounded-2xl p-8 shadow-lg"
              style={{
                background: "var(--surface, var(--cream-dark))",
                border: "1px solid var(--border, var(--gold-dark))",
              }}
            >
              <VerseInput onSubmit={handleSubmit} loading={isStreaming} />
            </div>

            {/* How it works */}
            <div className="mt-16 max-w-2xl text-center space-y-4 px-4">
              <h2
                className="font-arabic text-lg"
                style={{ color: "var(--gold-dark)" }}
              >
                منهجية التدبر
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-arabic">
                {[
                  {
                    step: "١",
                    title: "التلاوة بمنهج التلقي",
                    desc: "استقبال القرآن بحضور قلبي تام وشهود",
                  },
                  {
                    step: "٢",
                    title: "التعلم بمنهج التدارس",
                    desc: "فهم المعاني من مصادر التفسير المعتمدة",
                  },
                  {
                    step: "٣",
                    title: "التزكية بمنهج التدبر",
                    desc: "استخلاص الهدى المنهاجي ومسلك التخلق",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    className="rounded-xl p-4 space-y-2"
                    style={{
                      background: "var(--cream)",
                      border: "1px solid var(--border, var(--gold-dark))",
                    }}
                    dir="rtl"
                  >
                    <div
                      className="text-2xl font-bold"
                      style={{ color: "var(--gold)" }}
                    >
                      {s.step}
                    </div>
                    <div
                      className="font-bold"
                      style={{ color: "var(--ink)" }}
                    >
                      {s.title}
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Result screen */
          <div className="flex-1 flex flex-col lg:flex-row">
            {/* Sidebar */}
            <aside
              className="lg:w-72 shrink-0 p-6 border-b lg:border-b-0 lg:border-l"
              style={{
                borderColor: "var(--gold-dark)",
                background: "var(--surface, var(--cream-dark))",
              }}
            >
              <div className="lg:sticky lg:top-24 space-y-6" dir="rtl">
                {/* Current request info */}
                {currentRequest && (
                  <div className="space-y-3">
                    <h3
                      className="font-arabic font-bold text-lg"
                      style={{ color: "var(--gold-dark)" }}
                    >
                      {currentRequest.surah}
                    </h3>
                    <p
                      className="font-arabic text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      الآيات:{" "}
                      {currentRequest.verseNumbers[0]}
                      {currentRequest.verseNumbers.length > 1 &&
                        ` — ${
                          currentRequest.verseNumbers[
                            currentRequest.verseNumbers.length - 1
                          ]
                        }`}
                    </p>
                    <div
                      className="text-xs px-2 py-1 rounded-full inline-block font-arabic"
                      style={{ background: "var(--gold)", color: "#fff" }}
                    >
                      {currentRequest.language === "ar"
                        ? "عربي"
                        : currentRequest.language === "fr"
                        ? "Français"
                        : "عربي + Français"}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  {isStreaming && (
                    <div
                      className="flex items-center gap-2 font-arabic text-sm"
                      style={{ color: "var(--gold)" }}
                    >
                      <span className="loading-dot">◆</span>
                      <span>جارٍ التدبر...</span>
                    </div>
                  )}
                  {done && (
                    <div
                      className="font-arabic text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ✓ اكتمل التدبر
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={handleReset}
                    className="w-full py-2.5 px-4 rounded-lg font-arabic text-sm transition-all hover:opacity-80"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--gold-dark)",
                      color: "var(--ink)",
                    }}
                  >
                    → تدبر جديد
                  </button>

                  {done && (
                    <button
                      onClick={() => {
                        const blob = new Blob([text], {
                          type: "text/plain;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `tadabbur-${
                          currentRequest?.surah || "quran"
                        }.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg font-arabic text-sm transition-all hover:opacity-80"
                      style={{ background: "var(--gold-dark)", color: "#fff" }}
                    >
                      تحميل النص ↓
                    </button>
                  )}
                </div>

                {/* Verse list */}
                {currentRequest && currentRequest.verses.length > 0 && (
                  <div className="space-y-2">
                    <h4
                      className="font-arabic text-sm font-bold"
                      style={{ color: "var(--gold-dark)" }}
                    >
                      الآيات المُتَدَبَّرة:
                    </h4>
                    <div className="space-y-2">
                      {currentRequest.verses.map((v, i) => (
                        <div
                          key={i}
                          className="font-arabic text-sm p-2 rounded leading-loose"
                          style={{
                            background: "var(--cream)",
                            borderRight: "2px solid var(--gold)",
                            color: "var(--ink)",
                          }}
                          dir="rtl"
                        >
                          <span
                            className="text-xs ml-2"
                            style={{ color: "var(--gold)" }}
                          >
                            {currentRequest.verseNumbers[i]}
                          </span>
                          {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 p-6 lg:p-10 overflow-auto">
              {error ? (
                <div
                  className="font-arabic text-center p-8 rounded-xl"
                  style={{
                    background: "rgba(180,60,40,0.08)",
                    border: "1px solid rgba(180,60,40,0.3)",
                    color: "var(--ink)",
                  }}
                  dir="rtl"
                >
                  <p className="text-lg mb-2">حدث خطأ</p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {error}
                  </p>
                  <button
                    onClick={handleReset}
                    className="mt-4 px-4 py-2 rounded-lg font-arabic text-sm"
                    style={{ background: "var(--gold)", color: "#fff" }}
                  >
                    المحاولة مجددًا
                  </button>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto" dir="rtl">
                  {/* Title */}
                  {currentRequest && (
                    <div className="mb-8 text-center">
                      <div
                        className="font-arabic text-2xl font-bold mb-3"
                        style={{ color: "var(--gold-dark)" }}
                      >
                        تدبّر {currentRequest.surah}
                      </div>
                      <div className="gold-divider">
                        <span
                          style={{ color: "var(--gold)", fontSize: "0.6rem" }}
                        >
                          ✦ ✦ ✦
                        </span>
                      </div>
                    </div>
                  )}

                  <StreamingText text={text} isStreaming={isStreaming} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="px-6 py-4 text-center text-xs"
        style={{
          borderTop: "1px solid var(--gold-dark)",
          color: "var(--text-muted)",
        }}
      >
        <span className="font-arabic ml-2" dir="rtl">
          مستوحى من منهجية فريد الأنصاري في التدبر والتدارس
        </span>
        <span className="hidden sm:inline italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          · Inspiré de la méthodologie de Farid Al-Ansari
        </span>
      </footer>
    </div>
  );
}
