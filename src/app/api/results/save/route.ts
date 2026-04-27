/**
 * API route — save a tadabbur result to R2.
 * POST /api/results/save
 */
import { saveResult, type StoredResult } from "@/lib/results-storage";

export async function POST(req: Request) {
  try {
    const result: StoredResult = await req.json();
    if (!result.id || !result.text) {
      return new Response(JSON.stringify({ error: "Missing id or text" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log(`[results/save] Saving result ${result.id} (${result.surah} ${result.verseRange})`);
    console.log(`[results/save] VERCEL=${process.env.VERCEL}, R2_ENDPOINT=${process.env.R2_ENDPOINT ? "set" : "unset"}, R2_RESULTS_ACCESS_KEY_ID=${process.env.R2_RESULTS_ACCESS_KEY_ID ? "set" : "unset"}`);
    await saveResult(result);
    console.log(`[results/save] Saved successfully`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error(`[results/save] Error: ${msg}`);
    console.error(`[results/save] Stack: ${stack}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
