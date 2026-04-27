"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { TafsirName } from "@/lib/tafsir-loader";
import type { BahoussVerse } from "@/lib/bahouss-parser";

export type Depth = "brief" | "medium" | "detailed";
export type { TafsirName };

export interface TafsirSource {
  name: string;
  labelAr: string;
  content: string;
}

export interface SubmitData {
  verses: string[];
  surah: string;
  surahNumber: number;
  verseNumbers: number[];
  fromVerse: number;
  toVerse: number;
  depth: Depth;
  tafsirs: TafsirName[];
  crossReferences?: BahoussVerse[];
}

export type OnCompleteCallback = (text: string, resolvedVerses: string[] | null, contextTafsirs: TafsirSource[]) => void;

interface TadabburState {
  text: string;
  isStreaming: boolean;
  error: string | null;
  done: boolean;
  resolvedVerses: string[] | null;
  contextTafsirs: TafsirSource[];
}

export function useTadabbur(onComplete?: OnCompleteCallback) {
  const [state, setState] = useState<TadabburState>({
    text: "", isStreaming: false, error: null, done: false, resolvedVerses: null, contextTafsirs: [],
  });

  const textRef = useRef("");
  const resolvedVersesRef = useRef<string[] | null>(null);
  const contextTafsirsRef = useRef<TafsirSource[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const startTadabbur = useCallback(async (request: SubmitData) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    textRef.current = "";
    resolvedVersesRef.current = null;
    contextTafsirsRef.current = [];
    setState({ text: "", isStreaming: true, error: null, done: false, resolvedVerses: null, contextTafsirs: [] });

    try {
      const res = await fetch("/api/tadabbur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setState(s => ({ ...s, isStreaming: false, error: err.error || "حدث خطأ" }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "context") {
              contextTafsirsRef.current = parsed.tafsirs;
              setState(s => ({ ...s, contextTafsirs: parsed.tafsirs }));
            } else if (parsed.type === "verses") {
              resolvedVersesRef.current = parsed.verses;
              setState(s => ({ ...s, resolvedVerses: parsed.verses }));
            } else if (parsed.type === "text") {
              textRef.current += parsed.text;
              setState(s => ({ ...s, text: s.text + parsed.text }));
            } else if (parsed.type === "done") {
              setState(s => ({ ...s, isStreaming: false, done: true }));
              onComplete?.(textRef.current, resolvedVersesRef.current, contextTafsirsRef.current);
            } else if (parsed.type === "error") {
              setState(s => ({ ...s, isStreaming: false, error: parsed.message }));
            }
          } catch { /* ignore partial chunks */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState(s => ({
        ...s, isStreaming: false,
        error: err instanceof Error ? err.message : "خطأ في الاتصال",
      }));
    }
  }, [onComplete]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    textRef.current = "";
    resolvedVersesRef.current = null;
    contextTafsirsRef.current = [];
    setState({ text: "", isStreaming: false, error: null, done: false, resolvedVerses: null, contextTafsirs: [] });
  }, []);

  const restore = useCallback((text: string, resolvedVerses?: string[] | null, contextTafsirs?: TafsirSource[]) => {
    setState({ text, isStreaming: false, error: null, done: true, resolvedVerses: resolvedVerses ?? null, contextTafsirs: contextTafsirs ?? [] });
  }, []);

  return { ...state, startTadabbur, reset, restore };
}
