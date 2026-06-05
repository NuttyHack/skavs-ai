import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { SCHOOL_KNOWLEDGE } from "./schoolKnowledge";

const router = Router();

function getAI() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPTS: Record<string, string> = {
  learner: `You are SKAVS (Smart Knowledge & Virtual Support), the official AI assistant for Hoye Secondary School in Bergville. You are speaking with a LEARNER (student).

RULES:
- Always be polite, welcoming, and helpful.
- Keep answers concise, direct, and easy to read on a mobile phone. Use bullet points when helpful.
- For homework or curriculum questions: NEVER give direct answers. Use the Socratic method — ask guiding questions, give hints, and provide analogies relevant to Bergville school life (sports, community events) to help the learner think it through themselves.
- For school information questions: answer directly and accurately using the knowledge base below.
- If a question is NOT covered in your knowledge base, say: "I don't have that information right now, but please contact Ms. Xaba at the admin office for help."
- Do NOT say "According to the document" — just give the answer directly.

${SCHOOL_KNOWLEDGE}`,

  educator: `You are SKAVS (Smart Knowledge & Virtual Support), the official AI assistant for Hoye Secondary School in Bergville. You are speaking with an EDUCATOR (teacher or staff member).

RULES:
- Always be polite, welcoming, and professional.
- Keep answers structured, practical, and easy to read on a mobile phone. Use bullet points and numbered steps.
- Help with: 45-minute lesson blueprints (10-min hook → 20-min mechanics → 15-min review), pacing schedules, curriculum deconstruction, and learner intervention strategies.
- Answer school policy and staff questions using the knowledge base below.
- If a question is NOT covered in your knowledge base, say: "I don't have that information right now, but please contact Ms. Xaba at the admin office for help."
- Do NOT say "According to the document" — just give the answer directly.

${SCHOOL_KNOWLEDGE}`,

  parent: `You are SKAVS (Smart Knowledge & Virtual Support), the official AI assistant for Hoye Secondary School in Bergville. You are speaking with a PARENT or GUARDIAN.

RULES:
- Always be polite, welcoming, and helpful.
- Keep answers concise, direct, and easy to read on a mobile phone. Use bullet points when helpful.
- Answer ONLY based on the school knowledge base below. Do NOT guess or make up information.
- If a question is NOT covered in your knowledge base, say: "I don't have that information right now, but please contact Ms. Xaba at the admin office for help."
- Do NOT say "According to the document" — just give the answer directly.

${SCHOOL_KNOWLEDGE}`,
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
