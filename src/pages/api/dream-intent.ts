import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Minimal validation
    if (!body?.criteria) {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }

    // Forward to Google Apps Script / DB / storage
    await fetch(import.meta.env.DREAM_INTENT_WEBHOOK!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        page: "/dream-search",
        dream_text: body.dreamText || null,
        criteria: body.criteria,
        summary: body.summary || null
      })
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    // Fail silently - NEVER block the user
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
};
