import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body?.messages as ChatMessage[];
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return NextResponse.json({ error: "Please provide a valid conversation." }, { status: 400 });
    }
    if (messages.some((message) => !["user", "assistant"].includes(message?.role) || typeof message?.content !== "string" || !message.content.trim() || message.content.length > 12000)) {
      return NextResponse.json({ error: "One or more messages are invalid." }, { status: 400 });
    }
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI service is not configured yet. Add OPENROUTER_API_KEY or GROQ_API_KEY to .env.local." }, { status: 503 });
    const isOpenRouter = apiKey.startsWith("sk-or-");
    const providerResponse = await fetch(isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(isOpenRouter ? { "HTTP-Referer": "http://localhost:3000", "X-Title": "Walidu AI" } : {}),
      },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages, temperature: 0.7, max_tokens: 2048 }),
    });
    if (!providerResponse.ok) {
      if (providerResponse.status === 429) return NextResponse.json({ error: "Walidu is receiving a lot of requests. Please try again shortly." }, { status: 429 });
      if (providerResponse.status === 401 || providerResponse.status === 403) return NextResponse.json({ error: `This ${isOpenRouter ? "OpenRouter" : "Groq"} key cannot access AI inference. Check its permissions, billing, and organization settings.` }, { status: 502 });
      return NextResponse.json({ error: "Walidu could not complete that request. Please try again." }, { status: 502 });
    }
    const result = await providerResponse.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content) return NextResponse.json({ error: "The AI returned an empty response." }, { status: 502 });
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Unable to process your message right now." }, { status: 500 });
  }
}
