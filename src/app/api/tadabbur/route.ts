import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { getTafsirForVerses } from "@/lib/tafsir-loader";

export const runtime = "nodejs";
export const maxDuration = 120;

interface TadabburRequest {
  verses: string[];
  surah: string;
  surahNumber?: number;
  language: "ar" | "fr" | "both";
  verseNumbers?: number[];
}

function loadSystemPrompt(): string {
  const promptPath = path.join(process.cwd(), "system", "system-prompt.md");
  if (!fs.existsSync(promptPath)) {
    throw new Error("system-prompt.md not found. Please run Phase 1 setup.");
  }
  return fs.readFileSync(promptPath, "utf-8");
}

export async function POST(req: Request) {
  try {
    const body: TadabburRequest = await req.json();
    const { verses, surah, language, surahNumber, verseNumbers } = body;

    if (!verses || verses.length === 0) {
      return new Response(JSON.stringify({ error: "No verses provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (verses.length > 10) {
      return new Response(
        JSON.stringify({ error: "Maximum 10 verses per request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = loadSystemPrompt();

    // Load tafsir context if available
    let tafsirContext = "";
    if (surahNumber && verseNumbers && verseNumbers.length > 0) {
      const tafsirEntries = getTafsirForVerses(surahNumber, verseNumbers);
      if (tafsirEntries.length > 0) {
        tafsirContext =
          "\n\n<tafsir_context>\nفيما يلي مقتطفات من كتب التفسير المعتمدة للآيات المطلوبة:\n\n" +
          tafsirEntries
            .map(
              (t) =>
                `### ${t.labelAr}\n${t.content}`
            )
            .join("\n\n---\n\n") +
          "\n</tafsir_context>";
      }
    }

    const languageInstruction =
      language === "fr"
        ? "\n\nملاحظة: اكتب الهدى المنهاجي والتدبر باللغة الفرنسية الراقية."
        : language === "both"
        ? "\n\nملاحظة: اكتب التدبر بالعربية أساساً، ثم أضف بعد كل مجلس قسم «Résumé en français» يترجم الرسالات الرئيسية بالفرنسية."
        : "";

    const userMessage = `<request>
السورة: ${surah}
الآيات المطلوبة للتدبر:

${verses.map((v, i) => `الآية ${verseNumbers?.[i] ?? i + 1}: ${v}`).join("\n")}
</request>${tafsirContext}${languageInstruction}

طبّق المنهجية الكاملة وأنتج التدبر الشامل وفق المنهج المحدد. قسّم الآيات إلى مجالس منطقية واتبع الهيكل المطلوب لكل مجلس.`;

    const client = new Anthropic({ apiKey });

    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      stream: true,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({
                type: "text",
                text: event.delta.text,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else if (event.type === "message_stop") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`
            )
          );
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
      },
    });
  } catch (err) {
    console.error("Tadabbur API error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
