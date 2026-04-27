import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ShadingType,
  TabStopType, LeaderType, PageBreak,
} from "docx";
import type { TafsirSource } from "@/hooks/useTadabbur";
import type { BahoussVerse } from "@/lib/bahouss-parser";

// ── Design tokens ──────────────────────────────────────────────────────────
const GOLD       = "A87A2A";
const GOLD_WASH  = "F1E6CA";
const INK        = "1F1A12";
const FONT_AR    = "Amiri";
const FONT_TITLE = "Reem Kufi";
const HP = (pt: number) => pt * 2; // half-points

// ── Text parsing ───────────────────────────────────────────────────────────

interface DocSection { key: string; num: string; ar: string; content: string; }
interface DocMajlis  { index: number; title: string; sections: DocSection[]; isKhatm?: boolean; }

const SECTION_DEFS = [
  { key: "s1", num: "١", ar: "كلمات الابتلاء",  pattern: /كلمات الابتلاء/ },
  { key: "s2", num: "٢", ar: "البيان العامّ",    pattern: /البيان العام/ },
  { key: "s3", num: "٣", ar: "الهدى المنهجيّ",  pattern: /الهدى المنهاج/ },
  { key: "s4", num: "٤", ar: "مَسلك التَّخلُّق", pattern: /مسلك التخلق/ },
];

const KHATM_SECTION_DEFS = [
  { key: "k1", num: "١", ar: "المحور",   pattern: /المحور/ },
  { key: "k2", num: "٢", ar: "القضايا",  pattern: /القضايا/ },
  { key: "k3", num: "٣", ar: "الثمرة",   pattern: /الثمرة/ },
];

function parseSections(text: string, defs = SECTION_DEFS): DocSection[] {
  const positions: { pos: number; def: typeof defs[0] }[] = [];
  for (const def of defs) {
    const idx = text.search(new RegExp(`\\*\\*[١٢٣٤1-4]\\s*[-–]\\s*${def.pattern.source}`));
    if (idx >= 0) positions.push({ pos: idx, def });
  }
  if (!positions.length) return [];
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    const chunk = text.slice(p.pos, end);
    const nl = chunk.indexOf("\n");
    return {
      key: p.def.key, num: p.def.num, ar: p.def.ar,
      content: nl >= 0 ? chunk.slice(nl + 1).trim() : chunk,
    };
  });
}

function parseMajalisForDocx(text: string): DocMajlis[] {
  const MAJLIS_RE = /(?:\*\*المجلس\s+[^\n*]+?\*\*|#{1,3}\s*المجلس\s+[^\n]+)/g;
  const KHATM_RE  = /(?:\*\*خَ?تْ?م[^*\n]*\*\*|#{1,3}\s*خَ?تْ?م[^\n]+)/;
  const matches: { pos: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = MAJLIS_RE.exec(text)) !== null) {
    matches.push({ pos: m.index, title: m[0].replace(/^\*\*|\*\*$/g, "").replace(/^#{1,3}\s*/, "").trim() });
  }

  if (!matches.length) {
    const sections = parseSections(text);
    return sections.length ? [{ index: 1, title: "", sections }] : [];
  }

  const result: DocMajlis[] = matches.map((match, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].pos : text.length;
    const body = text.slice(match.pos, end).replace(/^[^\n]+\n/, "").replace(
      /---\n?Résumé en français[\s\S]*?(?=\n---|\n\*\*المجلس|\n##|$)/gi, ""
    );
    return { index: i + 1, title: match.title, sections: parseSections(body) };
  });

  // Detect خَتْم السورة after last مجلس
  const lastEnd = matches[matches.length - 1].pos;
  const tail = text.slice(lastEnd + text.slice(lastEnd).search(/\n/) + 1);
  const khatmM = KHATM_RE.exec(tail);
  if (khatmM) {
    const khatmBody = tail.slice(khatmM.index + khatmM[0].length).trim();
    const sections = parseSections(khatmBody, KHATM_SECTION_DEFS);
    if (sections.length) {
      result.push({
        index: result.length + 1,
        title: khatmM[0].replace(/^\*\*|\*\*$/g, "").replace(/^#{1,3}\s*/, "").trim(),
        sections,
        isKhatm: true,
      });
    }
  }

  return result;
}

// ── Paragraph builders ─────────────────────────────────────────────────────

function rtlRuns(text: string, size: number, opts?: { bold?: boolean; italic?: boolean; color?: string; font?: string }): TextRun {
  return new TextRun({
    text,
    font: { name: opts?.font ?? FONT_AR },
    size: HP(size),
    bold: opts?.bold,
    italics: opts?.italic,
    color: opts?.color ?? INK,
    rightToLeft: true,
  });
}

function parseInlineRuns(text: string, size: number, baseColor = INK): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|﴿[^﴾]+﴾)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      runs.push(rtlRuns(part.replace(/\*\*/g, ""), size, { bold: true, color: baseColor }));
    } else if (/^﴿[^﴾]+﴾$/.test(part)) {
      runs.push(rtlRuns(part, size + 2, { color: GOLD }));
    } else {
      runs.push(rtlRuns(part, size, { color: baseColor }));
    }
  }
  return runs.length ? runs : [rtlRuns("", size)];
}

function bodyToParagraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const block of text.split(/\n\n+/)) {
    const b = block.trim();
    if (!b) continue;

    // Standalone bold heading
    if (/^\*\*[^*\n]+\*\*:?$/.test(b)) {
      out.push(new Paragraph({
        children: [rtlRuns(b.replace(/^\*\*|\*\*:?$/g, "").trim(), 13, { bold: true, color: GOLD, font: FONT_TITLE })],
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 160, after: 80 },
      })); continue;
    }

    // Quranic verse box
    if (/﴿[^﴾]+﴾/.test(b)) {
      out.push(new Paragraph({
        children: parseInlineRuns(b, 16, INK),
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 180 },
        border: {
          top:    { style: BorderStyle.SINGLE, size: 6, color: GOLD },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD },
          left:   { style: BorderStyle.SINGLE, size: 6, color: GOLD },
          right:  { style: BorderStyle.SINGLE, size: 6, color: GOLD },
        },
        shading: { type: ShadingType.SOLID, color: GOLD_WASH },
      })); continue;
    }

    // Quote block starting with "
    if (/^["«]/.test(b)) {
      out.push(new Paragraph({
        children: parseInlineRuns(b.replace(/\n/g, " "), 13),
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120, after: 120, line: 360, lineRule: "auto" },
        indent: { right: 400, left: 400 },
        shading: { type: ShadingType.SOLID, color: GOLD_WASH },
        border: { right: { style: BorderStyle.THICK, size: 24, color: GOLD } },
      })); continue;
    }

    // Bullet list
    const lines = b.split("\n");
    if (lines.every(l => /^[•\-]/.test(l.trim()))) {
      for (const line of lines) {
        out.push(new Paragraph({
          children: parseInlineRuns(line.replace(/^[•\-]\s*/, "").trim(), 13),
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 60, after: 60 },
          indent: { right: 360 },
        }));
      } continue;
    }

    // Regular body paragraph
    out.push(new Paragraph({
      children: parseInlineRuns(b.replace(/\n/g, " "), 13),
      bidirectional: true,
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 80, after: 80, line: 480, lineRule: "auto" },
    }));
  }
  return out;
}

// ── Main export ────────────────────────────────────────────────────────────

export async function generateAndDownloadDocx(
  text: string,
  surahName: string,
  fromVerse: number,
  toVerse: number,
  tafsirs?: TafsirSource[],
  crossReferences?: BahoussVerse[],
) {
  const majalis = parseMajalisForDocx(text);
  const children: Paragraph[] = [];

  // ── Cover ──────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [rtlRuns("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", 18, { color: GOLD })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 2800, after: 600 },
  }));

  children.push(new Paragraph({
    children: [rtlRuns("تــدبّــر", 16, { color: GOLD, font: FONT_TITLE })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }));

  children.push(new Paragraph({
    children: [rtlRuns("مَجالِسُ التَّدَبُّر", 46, { bold: true, font: FONT_TITLE })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  children.push(new Paragraph({
    children: [rtlRuns(`من سُورة ${surahName}`, 24, { color: GOLD, font: FONT_TITLE })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { after: 500 },
  }));

  const rangeText = fromVerse === toVerse
    ? `الآية ${fromVerse}`
    : `الآيات ${fromVerse} – ${toVerse}`;
  children.push(new Paragraph({
    children: [rtlRuns(rangeText, 20, { bold: true, color: GOLD, font: FONT_TITLE })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    border: {
      top:    { style: BorderStyle.SINGLE, size: 12, color: GOLD },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD },
      left:   { style: BorderStyle.SINGLE, size: 12, color: GOLD },
      right:  { style: BorderStyle.SINGLE, size: 12, color: GOLD },
    },
    shading: { type: ShadingType.SOLID, color: GOLD_WASH },
  }));

  // Page break → TOC page
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── TOC ────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [rtlRuns("فهرس المجالس", 22, { bold: true, color: GOLD, font: FONT_TITLE })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 480 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
  }));

  for (const maj of majalis) {
    children.push(new Paragraph({
      children: [
        rtlRuns(maj.title || `المجلس ${maj.index}`, 13),
        new TextRun({ text: "\t" }),
      ],
      bidirectional: true, alignment: AlignmentType.RIGHT,
      spacing: { before: 100, after: 100 },
      tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: LeaderType.DOT }],
    }));
  }

  // Page break → content
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Majalis ────────────────────────────────────────────────────────────
  for (const maj of majalis) {
    const title = maj.title || (maj.isKhatm ? "خَتْم السورة" : `المجلس ${maj.index}`);

    // H1 — majlis title
    children.push(new Paragraph({
      children: [rtlRuns(title, maj.isKhatm ? 22 : 24, { bold: true, font: FONT_TITLE })],
      bidirectional: true, alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 240 },
      shading: { type: ShadingType.SOLID, color: GOLD_WASH },
      border: {
        bottom: { style: BorderStyle.THICK, size: 12, color: GOLD },
        top:    { style: BorderStyle.SINGLE, size: 4, color: GOLD },
        left:   { style: BorderStyle.SINGLE, size: 4, color: GOLD },
        right:  { style: BorderStyle.SINGLE, size: 4, color: GOLD },
      },
    }));

    for (const sec of maj.sections) {
      // H3 — sub-section
      children.push(new Paragraph({
        children: [rtlRuns(`${sec.num} — ${sec.ar}`, 14, { bold: true, color: GOLD, font: FONT_TITLE })],
        bidirectional: true, alignment: AlignmentType.RIGHT,
        spacing: { before: 360, after: 160 },
        border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: GOLD } },
      }));

      children.push(...bodyToParagraphs(sec.content));
    }

    // If no sections parsed, dump raw content as body
    if (!maj.sections.length) {
      children.push(...bodyToParagraphs(maj.title));
    }
  }

  // If no majalis at all, dump full text
  if (!majalis.length) {
    children.push(...bodyToParagraphs(text));
  }

  // ── Closing ────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    children: [rtlRuns("والحمد لله رب العالمين", 14, { bold: true, color: GOLD })],
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 960, after: 400 },
  }));

  // ── Appendix 1 — مصادر التفسير ────────────────────────────────────────
  if (tafsirs && tafsirs.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      children: [rtlRuns("ملحق ١ — مصادر التفسير المُستخدَمة", 22, { bold: true, font: FONT_TITLE })],
      bidirectional: true, alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 480 },
      shading: { type: ShadingType.SOLID, color: GOLD_WASH },
      border: { bottom: { style: BorderStyle.THICK, size: 12, color: GOLD } },
    }));
    for (const src of tafsirs) {
      children.push(new Paragraph({
        children: [rtlRuns(src.labelAr, 14, { bold: true, color: GOLD, font: FONT_TITLE })],
        bidirectional: true, alignment: AlignmentType.RIGHT,
        spacing: { before: 360, after: 160 },
        border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: GOLD } },
      }));
      children.push(...bodyToParagraphs(src.content));
    }
  }

  // ── Appendix 2 — الآيات المرجعية ──────────────────────────────────────
  if (crossReferences && crossReferences.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      children: [rtlRuns("ملحق ٢ — الآيات المرجعية", 22, { bold: true, font: FONT_TITLE })],
      bidirectional: true, alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 480 },
      shading: { type: ShadingType.SOLID, color: GOLD_WASH },
      border: { bottom: { style: BorderStyle.THICK, size: 12, color: GOLD } },
    }));
    for (const v of crossReferences) {
      children.push(new Paragraph({
        children: [rtlRuns(`سورة ${v.surahName} · آية ${v.ayah}`, 12, { bold: true, color: GOLD, font: FONT_TITLE })],
        bidirectional: true, alignment: AlignmentType.RIGHT,
        spacing: { before: 240, after: 80 },
      }));
      children.push(new Paragraph({
        children: parseInlineRuns(`﴿${v.text}﴾`, 16, INK),
        bidirectional: true, alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
        border: {
          top:    { style: BorderStyle.SINGLE, size: 6, color: GOLD },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD },
          left:   { style: BorderStyle.SINGLE, size: 6, color: GOLD },
          right:  { style: BorderStyle.SINGLE, size: 6, color: GOLD },
        },
        shading: { type: ShadingType.SOLID, color: GOLD_WASH },
      }));
      if (v.morphResult) {
        children.push(new Paragraph({
          children: [rtlRuns(v.morphResult, 12, { italic: true, color: GOLD })],
          bidirectional: true, alignment: AlignmentType.RIGHT,
          spacing: { before: 60, after: 160 },
        }));
      }
    }
  }

  // ── Build + download ───────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4 twips
          margin: { top: 1247, right: 1247, bottom: 1247, left: 1247 }, // 2.2cm
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = surahName.replace(/\s+/g, "_");
  a.download = `Majalis_${safeName}_${fromVerse}_${toVerse}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
