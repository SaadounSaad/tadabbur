import fs from "fs";
import path from "path";
import { getTafsirForVerses, type TafsirName, type TafsirEntry } from "@/lib/tafsir-loader";
import { getVerses } from "@/lib/quran-loader";
import type { BahoussVerse } from "@/lib/bahouss-parser";
import { tadabburCache, TadabburCache } from "@/lib/tadabbur-cache";

export const runtime = "nodejs";
export const maxDuration = 120;

interface TadabburRequest {
  verses: string[];
  surah: string;
  surahNumber?: number;
  verseNumbers?: number[];
  depth?: "brief" | "medium" | "detailed";
  tafsirs?: TafsirName[];
  crossReferences?: BahoussVerse[];
}

function loadSystemPrompt(): string {
  const promptPath = path.join(process.cwd(), "system", "system-prompt.md");
  if (!fs.existsSync(promptPath)) throw new Error("system-prompt.md not found.");
  return fs.readFileSync(promptPath, "utf-8");
}

export async function POST(req: Request) {
  try {
    const body: TadabburRequest = await req.json();
    const { verses, surah, surahNumber, verseNumbers, depth = "medium", tafsirs, crossReferences } = body;

    if (!verses || verses.length === 0)
      return new Response(JSON.stringify({ error: "No verses provided" }), { status: 400, headers: { "Content-Type": "application/json" } });

    if (verses.length > 10)
      return new Response(JSON.stringify({ error: "Maximum 10 verses per request" }), { status: 400, headers: { "Content-Type": "application/json" } });

    // Resolve placeholder verses (mode surah+range)
    const isPlaceholder = verses.length > 0 && verses[0].startsWith("[الآية");
    let resolvedVerses = verses;
    if (isPlaceholder && surahNumber && verseNumbers && verseNumbers.length > 0) {
      const from = verseNumbers[0];
      const to = verseNumbers[verseNumbers.length - 1];
      const real = getVerses(surahNumber, from, to);
      if (real.length > 0) resolvedVerses = real;
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      return new Response(JSON.stringify({ error: "No API key configured — set OPENROUTER_API_KEY or ANTHROPIC_API_KEY" }), { status: 500, headers: { "Content-Type": "application/json" } });

    const systemPrompt = loadSystemPrompt();

    let tafsirContext = "";
    let tafsirEntries: TafsirEntry[] = [];
    if (surahNumber && verseNumbers && verseNumbers.length > 0) {
      tafsirEntries = getTafsirForVerses(surahNumber, verseNumbers, tafsirs?.length ? tafsirs : undefined);
      if (tafsirEntries.length > 0) {
        tafsirContext =
          "\n\n<tafsir_context>\nفيما يلي مقتطفات من كتب التفسير المعتمدة للآيات المطلوبة:\n\n" +
          tafsirEntries.map(t => `### ${t.labelAr}\n${t.content}`).join("\n\n---\n\n") +
          "\n</tafsir_context>";
      }
    }

    const depthInstruction =
      depth === "brief"
        ? "\n\nملاحظة: اكتب تدبّراً موجزاً ومركّزاً — مجلسٌ واحد لا يتجاوز ٣٠٠ كلمة، مع الحرص على اكتمال عناصر المنهج الأربعة بصورة مختصرة."
        : depth === "detailed"
        ? "\n\nملاحظة: اكتب تدبّراً مُفصَّلاً وغنيًّا — توسّع في الهدى المنهاجي واذكر رسالات متعددة مع شواهد وافرة من التراث."
        : "";

    let crossRefContext = "";
    if (crossReferences && crossReferences.length > 0) {
      const lines = crossReferences
        .map((v, i) => `${i + 1}. سورة ${v.surahName} آية ${v.ayah}: ${v.text}`)
        .join("\n");
      crossRefContext =
        "\n\n<quranic_cross_references>\n" +
        "هذه آيات من القرآن الكريم تتعلق بنفس المفهوم الذي تعالجه الآيات المتدبَّرة.\n" +
        "اختر منها ما يُنير التدبر ويُغني البيان العام أو الهدى المنهاجي.\n" +
        "لا تُقحم آية لمجرد وجودها — استخدمها فقط إن أضافت بصيرة حقيقية.\n\n" +
        lines +
        "\n</quranic_cross_references>";
    }

    const userMessage = `<request>
السورة: ${surah}
الآيات المطلوبة للتدبر:

${resolvedVerses.map((v, i) => `الآية ${verseNumbers?.[i] ?? i + 1}: ${v}`).join("\n")}
</request>${tafsirContext}${crossRefContext}${depthInstruction}

طبّق المنهجية الكاملة وأنتج التدبر الشامل وفق المنهج المحدد. قسّم الآيات إلى مجالس منطقية واتبع الهيكل المطلوب لكل مجلس.`;

    // --- Cache check ---
    const cacheKey = TadabburCache.makeKey({
      surahNumber,
      verseNumbers,
      depth,
      tafsirs,
      crossReferences,
    });
    const cached = tadabburCache.get(cacheKey);

    if (cached) {
      // Replay cached response as SSE stream
      const encoder = new TextEncoder();
      const cachedStream = new ReadableStream({
        async start(controller) {
          try {
            if (cached.tafsirEntries.length > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "context", tafsirs: cached.tafsirEntries })}\n\n`)
              );
            }
            if (cached.isPlaceholder && cached.resolvedVerses) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "verses", verses: cached.resolvedVerses })}\n\n`)
              );
            }
            // Send cached text in chunks to simulate streaming
            const chunkSize = 80;
            for (let i = 0; i < cached.text.length; i += chunkSize) {
              const chunk = cached.text.slice(i, i + chunkSize);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Cache replay error";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(cachedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Cache": "HIT",
        },
      });
    }

    // --- Cache miss — call OpenRouter ---
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const isOpenRouter = !!openRouterKey && openRouterKey.startsWith("sk-or-");

    if (!openRouterKey && !anthropicKey)
      return new Response(JSON.stringify({ error: "No API key configured — set OPENROUTER_API_KEY or ANTHROPIC_API_KEY" }), { status: 500, headers: { "Content-Type": "application/json" } });

    // Map our depth to model names
    const openRouterModel =
      depth === "detailed"
        ? "anthropic/claude-sonnet-4-6"
        : "anthropic/claude-3-5-haiku";

    const anthropicModel =
      depth === "detailed" ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";

    const encoder = new TextEncoder();
    let accumulatedText = "";

    if (isOpenRouter) {
      // ── OpenRouter (OpenAI-compatible API) ────────────────────────────
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://qtadabbur.vercel.app",
          "X-Title": "Tadabbur",
        },
        body: JSON.stringify({
          model: openRouterModel,
          max_tokens: 32000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        return new Response(JSON.stringify({ error: `OpenRouter error ${response.status}: ${errBody}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            if (tafsirEntries.length > 0) {
              const payload = tafsirEntries.map(({ name, labelAr, content }) => ({ name, labelAr, content }));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "context", tafsirs: payload })}\n\n`));
            }
            if (isPlaceholder) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "verses", verses: resolvedVerses })}\n\n`));
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");
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
                if (!data || data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  if (content) {
                    accumulatedText += content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: content })}\n\n`));
                  }
                } catch { /* ignore partial */ }
              }
            }

            // Store in cache
            tadabburCache.set(cacheKey, {
              text: accumulatedText,
              tafsirEntries: tafsirEntries.map(({ name, labelAr, content }) => ({ name, labelAr, content })),
              resolvedVerses: isPlaceholder ? resolvedVerses : null,
              isPlaceholder,
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Stream error";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Cache": "MISS",
          "X-Provider": "openrouter",
        },
      });
    }

    // ── Fallback: direct Anthropic API ──────────────────────────────────
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: openRouterKey });
    const stream = await client.messages.create({
      model: anthropicModel,
      max_tokens: 32000,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
      stream: true,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          if (tafsirEntries.length > 0) {
            const payload = tafsirEntries.map(({ name, labelAr, content }) => ({ name, labelAr, content }));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "context", tafsirs: payload })}\n\n`));
          }
          if (isPlaceholder) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "verses", verses: resolvedVerses })}\n\n`));
          }
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              accumulatedText += event.delta.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`));
            } else if (event.type === "message_stop") {
              tadabburCache.set(cacheKey, {
                text: accumulatedText,
                tafsirEntries: tafsirEntries.map(({ name, labelAr, content }) => ({ name, labelAr, content })),
                resolvedVerses: isPlaceholder ? resolvedVerses : null,
                isPlaceholder,
              });
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Cache": "MISS",
        "X-Provider": "anthropic",
      },
    });
  } catch (err) {
    console.error("Tadabbur API error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
