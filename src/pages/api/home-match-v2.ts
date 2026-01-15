// File: src/pages/api/home-match-v2.ts
import type { APIRoute } from "astro";
import { buildHomeMatchMessagesV2, extractMachineBlockV2 } from "../../ai/homeMatchV2";
import { chatComplete } from "../../lib/openai"; // point this import to your existing OpenAI helper

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));

    const mode = (body?.mode === "free_text" ? "free_text" : "guided") as
      | "guided"
      | "free_text";

    const text = String(body?.text ?? "").trim();

    const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
    const aWho = String(answers?.who ?? "").trim();
    const aBudget = String(answers?.budget ?? "").trim();
    const aTiming = String(answers?.timing ?? "").trim();
    const aPriorities = String(answers?.priorities ?? "").trim();
    const aNotes = String(answers?.notes ?? "").trim();

    const normalized =
      mode === "free_text"
        ? text
        : [
            aWho ? `Who: ${aWho}` : "",
            aBudget ? `Budget: ${aBudget}` : "",
            aTiming ? `Timing: ${aTiming}` : "",
            aPriorities ? `Priorities: ${aPriorities}` : "",
            aNotes ? `Notes: ${aNotes}` : "",
          ]
            .filter(Boolean)
            .join("\n");

    if (!normalized) {
      return new Response(JSON.stringify({ ok: false, error: "Missing input" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = buildHomeMatchMessagesV2({ mode, normalized });

    const raw = await chatComplete({
      messages,
      model: "gpt-4.1-mini",
      temperature: 0.4,
    });

    const { visibleMarkdown, machine } = extractMachineBlockV2(String(raw || ""));

    const html = markdownToHtmlLite(visibleMarkdown);

    return new Response(
      JSON.stringify({
        ok: true,
        markdown: visibleMarkdown,
        html,
        machine,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Tiny markdown-ish converter - minimal and safe.
// Replace with your renderer if you already have one.
function markdownToHtmlLite(md: string) {
  const lines = String(md || "").split("\n");
  const out: string[] = [];
  let inUl = false;

  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };

  for (const lineRaw of lines) {
    const line = lineRaw.trimEnd();

    if (!line.trim()) {
      closeUl();
      continue;
    }

    if (line.startsWith("### ")) {
      closeUl();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeUl();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      closeUl();
      out.push(`<h2>${escapeHtml(line.slice(2))}</h2>`);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${escapeInline(line.slice(2))}</li>`);
      continue;
    }

    closeUl();
    out.push(`<p>${escapeInline(line)}</p>`);
  }

  closeUl();
  return out.join("\n");
}

function escapeHtml(str: string) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeInline(str: string) {
  let s = escapeHtml(str);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
  );
  return s;
}
