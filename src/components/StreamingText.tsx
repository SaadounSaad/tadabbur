"use client";
import { useEffect, useRef } from "react";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export default function StreamingText({ text, isStreaming }: StreamingTextProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [text, isStreaming]);

  // Parse text into sections for better rendering
  const formatted = formatTadabburText(text);

  return (
    <div
      className="font-arabic text-base leading-loose"
      style={{ color: "var(--ink)", direction: "rtl", textAlign: "right" }}
      dir="rtl"
    >
      <div dangerouslySetInnerHTML={{ __html: formatted }} />
      {isStreaming && (
        <span
          className="inline-block w-0.5 h-5 mr-1 loading-dot"
          style={{ background: "var(--gold)", verticalAlign: "middle" }}
        />
      )}
      <div ref={endRef} />
    </div>
  );
}

function formatTadabburText(text: string): string {
  if (!text) return "";

  let html = text;

  // Escape HTML first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Quran verse markers ﴿...﴾
  html = html.replace(
    /﴿([^﴾]+)﴾/g,
    `<span style="color:var(--ink);font-size:1.1em;font-weight:600">﴿$1﴾</span>`
  );

  // Section headers: المجلس X or numbered headers
  html = html.replace(
    /(المجلس\s+\S+[^:\n]*:?)/g,
    `<h2 style="font-size:1.4rem;color:var(--gold-dark);border-bottom:1px solid var(--gold);padding-bottom:0.3rem;margin:2rem 0 1rem;font-weight:700">$1</h2>`
  );

  // Sub-section numbers: ١ - or ١-
  html = html.replace(
    /^([١٢٣٤٥٦٧٨٩٠\d]+\s*[-–]\s*.+)$/gm,
    `<h3 style="font-size:1.15rem;color:var(--gold-dark);margin:1.5rem 0 0.5rem;font-weight:600">$1</h3>`
  );

  // Rasala headers
  html = html.replace(
    /(الرسالة\s+\S+[:：]?)/g,
    `<div style="border-right:3px solid var(--gold);padding-right:0.75rem;margin:1rem 0 0.25rem;font-weight:700;color:var(--ink-light)">$1</div>`
  );

  // Horizontal rules (---)
  html = html.replace(
    /^---+$/gm,
    `<div style="height:1px;background:linear-gradient(to right,transparent,var(--gold),transparent);margin:2rem 0"></div>`
  );

  // Newlines to paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return "";
      // Don't wrap already-HTML elements
      if (p.startsWith("<h") || p.startsWith("<div")) return p;
      return `<p style="margin-bottom:1em">${p.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  return html;
}
