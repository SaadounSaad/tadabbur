"use client";
import { useState, useCallback } from "react";

interface TadabburRequest {
  verses: string[];
  surah: string;
  surahNumber: number;
  verseNumbers: number[];
  language: "ar" | "fr" | "both";
}

interface TadabburState {
  text: string;
  isStreaming: boolean;
  error: string | null;
  done: boolean;
}

export function useTadabbur() {
  const [state, setState] = useState<TadabburState>({
    text: "",
    isStreaming: false,
    error: null,
    done: false,
  });

  const startTadabbur = useCallback(async (request: TadabburRequest) => {
    setState({ text: "", isStreaming: true, error: null, done: false });

    try {
      const res = await fetch("/api/tadabbur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setState((s) => ({
          ...s,
          isStreaming: false,
          error: err.error || "حدث خطأ",
        }));
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
            if (parsed.type === "text") {
              setState((s) => ({ ...s, text: s.text + parsed.text }));
            } else if (parsed.type === "done") {
              setState((s) => ({ ...s, isStreaming: false, done: true }));
            } else if (parsed.type === "error") {
              setState((s) => ({
                ...s,
                isStreaming: false,
                error: parsed.message,
              }));
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: err instanceof Error ? err.message : "خطأ في الاتصال",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ text: "", isStreaming: false, error: null, done: false });
  }, []);

  return { ...state, startTadabbur, reset };
}
