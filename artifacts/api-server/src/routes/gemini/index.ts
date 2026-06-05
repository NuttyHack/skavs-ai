import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

function getAI() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPTS: Record<string, string> = {
  learner: `You are SKAVS, the AI tutor for Hoye Secondary School students. Your mission is to guide students using the Socratic method — never give direct homework answers. Instead, ask probing questions, provide contextual analogies relevant to local school life (sports, school events, familiar places), and help students arrive at understanding through iterative hints. If a student asks for a direct answer to homework or an exam question, gently redirect them with a hint or question instead. Be warm, encouraging, and patient. Keep responses concise and mobile-friendly.`,

  educator: `You are SKAVS, the Lesson Architect for Hoye Secondary School teachers. Help educators with: (1) Creating 45-minute lesson blueprints (10-min engagement hook, 20-min key mechanics, 15-min formative review), (2) Realistic pacing schedules given constraints like teaching hours per week, (3) Curriculum deconstruction from dense source material, (4) Strategies for addressing common student misconceptions. Be professional, practical, and efficient. Keep responses structured and mobile-friendly.`,

  parent: `You are SKAVS, the Information Officer for Hoye Secondary School parents and guardians. Provide clear, concise answers about: registration schedules, required documents, uniform policy, school calendar, fee structures, academic programs, and school events. Format answers in short text packets for easy reading on mobile. If you don't know specific details, say so clearly and suggest contacting the school office directly. Be welcoming and accessible.`,
};

router.get("/conversations", async (req, res) => {
  try {
    const all = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(all);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title, role } = req.body as { title: string; role: string };
    if (!title || !role) {
      res.status(400).json({ error: "title and role are required" });
      return;
    }
    const [conv] = await db
      .insert(conversations)
      .values({ title, role })
      .returning();
    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    const { content } = req.body as { content: string };
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content,
    });

    const chatHistory = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const role = conv.role ?? "parent";
    const systemPrompt = SYSTEM_PROMPTS[role] ?? SYSTEM_PROMPTS["parent"]!;

    const ai = getAI();
    let fullResponse = "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 8192,
      },
      contents: chatHistory.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
