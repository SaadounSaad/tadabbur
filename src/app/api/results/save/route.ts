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
    await saveResult(result);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Save result error:", err);
    return new Response(JSON.stringify({ error: "Failed to save" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
