"use client";
import { useState } from "react";
import type { SubmitData, TafsirName } from "@/hooks/useTadabbur";

const TAFSIRS: { name: TafsirName; labelAr: string }[] = [
  { name: "ibn-achour",  labelAr: "ابن عاشور" },
  { name: "muharrar",    labelAr: "المحرر" },
  { name: "tabari",      labelAr: "الطبري" },
  { name: "fakhri-razi", labelAr: "الفخر الرازي" },
  { name: "ibn-kathir",  labelAr: "ابن كثير" },
  { name: "fi-zilal",    labelAr: "في ظلال القرآن" },
];

// [surahNumber, nameAr, verseCount]
const SURAHS: [number, string, number][] = [
  [1,"الفاتحة",7],[2,"البقرة",286],[3,"آل عمران",200],[4,"النساء",176],
  [5,"المائدة",120],[6,"الأنعام",165],[7,"الأعراف",206],[8,"الأنفال",75],
  [9,"التوبة",129],[10,"يونس",109],[11,"هود",123],[12,"يوسف",111],
  [13,"الرعد",43],[14,"إبراهيم",52],[15,"الحجر",99],[16,"النحل",128],
  [17,"الإسراء",111],[18,"الكهف",110],[19,"مريم",98],[20,"طه",135],
  [21,"الأنبياء",112],[22,"الحج",78],[23,"المؤمنون",118],[24,"النور",64],
  [25,"الفرقان",77],[26,"الشعراء",227],[27,"النمل",93],[28,"القصص",88],
  [29,"العنكبوت",69],[30,"الروم",60],[31,"لقمان",34],[32,"السجدة",30],
  [33,"الأحزاب",73],[34,"سبأ",54],[35,"فاطر",45],[36,"يس",83],
  [37,"الصافات",182],[38,"ص",88],[39,"الزمر",75],[40,"غافر",85],
  [41,"فصلت",54],[42,"الشورى",53],[43,"الزخرف",89],[44,"الدخان",59],
  [45,"الجاثية",37],[46,"الأحقاف",35],[47,"محمد",38],[48,"الفتح",29],
  [49,"الحجرات",18],[50,"ق",45],[51,"الذاريات",60],[52,"الطور",49],
  [53,"النجم",62],[54,"القمر",55],[55,"الرحمن",78],[56,"الواقعة",96],
  [57,"الحديد",29],[58,"المجادلة",22],[59,"الحشر",24],[60,"الممتحنة",13],
  [61,"الصف",14],[62,"الجمعة",11],[63,"المنافقون",11],[64,"التغابن",18],
  [65,"الطلاق",12],[66,"التحريم",12],[67,"الملك",30],[68,"القلم",52],
  [69,"الحاقة",52],[70,"المعارج",44],[71,"نوح",28],[72,"الجن",28],
  [73,"المزمل",20],[74,"المدثر",56],[75,"القيامة",40],[76,"الإنسان",31],
  [77,"المرسلات",50],[78,"النبأ",40],[79,"النازعات",46],[80,"عبس",42],
  [81,"التكوير",29],[82,"الانفطار",19],[83,"المطففين",36],[84,"الانشقاق",25],
  [85,"البروج",22],[86,"الطارق",17],[87,"الأعلى",19],[88,"الغاشية",26],
  [89,"الفجر",30],[90,"البلد",20],[91,"الشمس",15],[92,"الليل",21],
  [93,"الضحى",11],[94,"الشرح",8],[95,"التين",8],[96,"العلق",19],
  [97,"القدر",5],[98,"البينة",8],[99,"الزلزلة",8],[100,"العاديات",11],
  [101,"القارعة",11],[102,"التكاثر",8],[103,"العصر",3],[104,"الهمزة",9],
  [105,"الفيل",5],[106,"قريش",4],[107,"الماعون",7],[108,"الكوثر",3],
  [109,"الكافرون",6],[110,"النصر",3],[111,"المسد",5],[112,"الإخلاص",4],
  [113,"الفلق",5],[114,"الناس",6],
];


interface VerseInputProps {
  onSubmit: (data: SubmitData) => void;
  loading: boolean;
}

export default function VerseInput({ onSubmit, loading }: VerseInputProps) {
  const [tab, setTab] = useState<"surah" | "text">("surah");
  const [surahIdx, setSurahIdx] = useState(1);
  const [verseFrom, setVerseFrom] = useState(255);
  const [verseTo, setVerseTo] = useState(257);
  const [manualText, setManualText] = useState("");
  const [manualStart, setManualStart] = useState(1);
  const [depth, setDepth] = useState<"brief" | "medium" | "detailed">("medium");
  const [selectedTafsirs, setSelectedTafsirs] = useState<TafsirName[]>(["ibn-kathir"]);

  function toggleTafsir(name: TafsirName) {
    setSelectedTafsirs(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  }

  const selectedSurah = SURAHS[surahIdx];
  const maxVerse = selectedSurah[2];

  function changeSurah(idx: number) {
    setSurahIdx(idx);
    const total = SURAHS[idx][2];
    setVerseFrom(1);
    setVerseTo(Math.min(5, total));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let verses: string[];
    let verseNumbers: number[];

    if (tab === "text") {
      verses = manualText.split("\n").map(v => v.trim()).filter(Boolean).slice(0, 10);
      verseNumbers = verses.map((_, i) => manualStart + i);
    } else {
      const count = Math.max(1, Math.min(verseTo - verseFrom + 1, 10));
      verses = Array.from({ length: count }, (_, i) => `[الآية ${verseFrom + i}]`);
      verseNumbers = Array.from({ length: count }, (_, i) => verseFrom + i);
    }

    if (verses.length === 0) return;

    onSubmit({
      verses,
      surah: selectedSurah[1],
      surahNumber: selectedSurah[0],
      verseNumbers,
      fromVerse: verseNumbers[0],
      toVerse: verseNumbers[verseNumbers.length - 1],
      depth,
      tafsirs: selectedTafsirs,
    });
  }

  return (
    <form onSubmit={handleSubmit} dir="rtl">
      <div className="form-tabs">
        <button type="button" className={`form-tab${tab === "surah" ? " active" : ""}`} onClick={() => setTab("surah")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/></svg>
          سُورةٌ وآيات
        </button>
        <button type="button" className={`form-tab${tab === "text" ? " active" : ""}`} onClick={() => setTab("text")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          نصٌّ مُخصَّص
        </button>
      </div>

      {tab === "surah" ? (
        <>
          <div className="field">
            <label className="field-label">السُّورة</label>
            <select
              className="select-field"
              value={surahIdx}
              onChange={e => changeSurah(Number(e.target.value))}
            >
              {SURAHS.map(([num, ar], i) => (
                <option key={num} value={i}>
                  {num}. {ar}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label">من الآية</label>
              <input
                type="number" min={1} max={maxVerse} className="input"
                value={verseFrom}
                onChange={e => {
                  const v = Math.min(Number(e.target.value), maxVerse);
                  setVerseFrom(v);
                  if (verseTo < v) setVerseTo(v);
                }}
              />
            </div>
            <div className="field">
              <label className="field-label">
                إلى الآية{" "}
                <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                  (max {maxVerse}، ١٠ آياتٍ حدًّا)
                </span>
              </label>
              <input
                type="number" min={verseFrom} max={Math.min(verseFrom + 9, maxVerse)} className="input"
                value={verseTo}
                onChange={e => {
                  const v = Math.min(Number(e.target.value), verseFrom + 9, maxVerse);
                  setVerseTo(Math.max(v, verseFrom));
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field-label">الآيات — سطرٌ لكلّ آية (١٠ كحدٍّ أقصى)</label>
            <textarea
              className="textarea-field"
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder={"أدخل كل آية في سطر مستقل\nمثال:\nبِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nالْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"}
              dir="rtl"
            />
          </div>
          <div className="field">
            <label className="field-label">رقم الآية الأولى</label>
            <input
              type="number" min={1} className="input" style={{ maxWidth: 120 }}
              value={manualStart}
              onChange={e => setManualStart(Number(e.target.value))}
            />
          </div>
        </>
      )}

      <div className="field">
        <label className="field-label">عُمق التدبّر</label>
        <div className="lang-pills">
          {(["brief", "medium", "detailed"] as const).map(d => (
            <button
              key={d}
              type="button"
              className={`lang-pill${depth === d ? " active" : ""}`}
              onClick={() => setDepth(d)}
            >
              {d === "brief" ? "موجزٌ" : d === "medium" ? "متوسّط" : "مُفصَّل"}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">
          مصادر التفسير
          <span style={{ color: "var(--ink-3)", fontWeight: 400, marginRight: 6 }}>
            ({selectedTafsirs.length === 0 ? "بدون تفسير" : `${selectedTafsirs.length} مصادر`})
          </span>
        </label>
        <div className="lang-pills">
          {TAFSIRS.map(t => (
            <button
              key={t.name}
              type="button"
              className={`lang-pill${selectedTafsirs.includes(t.name) ? " active" : ""}`}
              onClick={() => toggleTafsir(t.name)}
            >
              {t.labelAr}
            </button>
          ))}
        </div>
      </div>

      <div className="form-foot">
        <span className="form-hint">سيُولَّد التدبّر مباشرةً بعد الإرسال</span>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <span style={{ animation: "pulse-dot 1s infinite" }}>•</span>
              جارٍ التوليد…
            </>
          ) : (
            <>
              ابدأ التدبُّر
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
