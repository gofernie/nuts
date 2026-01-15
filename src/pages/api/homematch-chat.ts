// File: src/pages/api/homematch-chat.ts
import type { APIRoute } from "astro";
import { runHomeMatchChat } from "../../ai/homeMatchChat";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const message = String(body?.message || "");
    const history = Array.isArray(body?.history) ? body.history : [];
    const state = body?.state || null;

    const out = await runHomeMatchChat({ message, history, state });

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ reply: "Sorry - something failed. Please try again.", state: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
