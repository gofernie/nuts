// File: src/ai/homeMatchV2.ts
import { HOME_MATCH_SYSTEM_PROMPT_V2 } from "./homeMatchPromptV2";

type Mode = "guided" | "free_text";

export function buildHomeMatchMessagesV2(opts: { mode: Mode; normalized: string }) {
  const modeLine =
    opts.mode === "free_text"
      ? "Mode: free_text (user wrote a natural language description)."
      : "Mode: guided (user answered structured questions).";

  return [
    { role: "system", content: HOME_MATCH_SYSTEM_PROMPT_V2 },
    { role: "user", content: `${modeLine}\n\nUser input:\n${opts.normalized}` },
  ];
}

export function extractMachineBlockV2(raw: string): {
  visibleMarkdown: string;
  machine: { neighbourhoods: string[]; property_types: string[] } | null;
} {
  const text = String(raw || "");

  const startTag = "<fh_json>";
  const endTag = "</fh_json>";

  const start = text.indexOf(startTag);
  const end = text.indexOf(endTag);

  if (start === -1 || end === -1 || end <= start) {
    return { visibleMarkdown: text.trim(), machine: null };
  }

  const visible = (text.slice(0, start) + text.slice(end + endTag.length)).trim();
  const machineJson = text.slice(start + startTag.length, end).trim();

  const parsed = safeParseJson(machineJson);
  if (!parsed || typeof parsed !== "object") {
    return { visibleMarkdown: visible, machine: null };
  }

  const neighbourhoods = Array.isArray((parsed as any).neighbourhoods)
    ? (parsed as any).neighbourhoods.map((s: any) => String(s || "").trim()).filter(Boolean)
    : [];

  const property_types = Array.isArray((parsed as any).property_types)
    ? (parsed as any).property_types.map((s: any) => String(s || "").trim()).filter(Boolean)
    : [];

  return { visibleMarkdown: visible, machine: { neighbourhoods, property_types } };
}

function safeParseJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
