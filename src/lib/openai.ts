// File: src/lib/openai.ts
// Minimal OpenAI chat helper for Astro API routes

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chatComplete(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
}) {
  const apiKey =
    import.meta.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const model = opts.model || "gpt-4.1-mini";
  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : 0.4;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const json: any = await res.json();

  return String(
    json?.choices?.[0]?.message?.content ?? ""
  );
}
