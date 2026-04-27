/**
 * API route — load all tadabbur results from R2.
 * GET /api/results/load
 */
import { loadResults } from "@/lib/results-storage";

export async function GET() {
  try {
    const results = await loadResults();
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Load results error:", err);
    return new Response(JSON.stringify({ error: "Failed to load" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
