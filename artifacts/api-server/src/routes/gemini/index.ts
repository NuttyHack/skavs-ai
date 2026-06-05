import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, resources } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { SCHOOL_KNOWLEDGE } from "./schoolKnowledge";

const router = Router();

function getAI() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function getEducatorPassword() {
  return process.env["EDUCATOR_PASSWORD"] ?? "Hoye2026";
}

const FORMATTING_RULES = `
FORMATTING RULES (strictly follow these):
- Write in plain, professional prose. Do NOT use markdown symbols.
- Do NOT use asterisks (*) for bold, bullet points, or any emphasis.
- Do NOT use hash signs (#) for headings.
- Do NOT use underscores (_) for italics.
- Do NOT use backticks (\`) for code.
- For lists, use a simple dash (-) followed by a space, or numbered items like "1. Item".
- Separate sections with a blank line.
- Keep your tone warm, clear, and professional — like a trusted school advisor speaking directly.
- Always address the user by their first name in every single response.
`;

function buildSystemPrompt(role: string, name: string, grade?: string | null): string {
  const gradeContext = grade
    ? `This learner is in Grade ${grade}. Adjust your language and explanations to be appropriate for a Grade ${grade} student in a South African secondary school.`
    : "";

  const base = `You are SKAVS (Smart Knowledge & Virtual Support), the official AI assistant for Hoye Secondary School in Bergville, KwaZulu-Natal, South Africa.
The user's name is ${name}. Address them as ${name} in every single response — do not skip this.

${FORMATTING_RULES}

If a question is not covered in your knowledge base below, respond with: "I don't have that information right now, ${name}, but please contact Ms. Xaba at the admin office for help."
Do NOT say "According to the document" — just give the answer naturally and directly.`;

  if (role === "learner") {
    return `${base}

You are speaking with a LEARNER (student) named ${name}. ${gradeContext}

LEARNER-SPECIFIC RULES:
- For homework or exam questions: NEVER give the direct answer. Instead, use the Socratic method — ask a guiding question or offer a hint that helps ${name} think it through. Use analogies from Bergville life (community, sport, school events) to make concepts relatable.
- For school information questions (uniform, fees, staff, timetable, etc.): answer directly and accurately.
- Keep responses short and easy to read on a mobile phone.
- Be encouraging and patient. ${name} can do it.

${SCHOOL_KNOWLEDGE}`;
  }

  if (role === "educator") {
    return `${base}

You are speaking with an EDUCATOR (teacher or staff member) named ${name}.

EDUCATOR-SPECIFIC RULES:
- Help with: creating 45-minute lesson blueprints (10-min engagement hook, 20-min key mechanics, 15-min formative review), pacing schedules, curriculum deconstruction, learner intervention strategies, and assessment design.
- If an image or document is shared, analyze it carefully and provide detailed professional feedback.
- Keep responses structured and practical for a busy teacher on a mobile phone.
- You may answer any school policy or staff management questions using the knowledge base.

${SCHOOL_KNOWLEDGE}`;
  }

  // parent
  return `${base}

You are speaking with a PARENT or GUARDIAN named ${name}.

PARENT-SPECIFIC RULES:
- Answer questions about registration, documents, uniform, fees, calendar, staff contacts, and school policies.
- Answer ONLY based on the school knowledge base. Do NOT guess or invent information.
- Keep answers short and easy to read on a mobile phone.

${SCHOOL_KNOWLEDGE}`;
}

// ─── Educator Auth ────────────────────────────────────────────────────────────

router.post("/educator/verify", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ ok: false, error: "Password required" });
    return;
  }
  if (password === getEducatorPassword()) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Incorrect password" });
  }
});

// ─── Educator Trending ───────────────────────────────────────────────────────

router.get("/educator/trending", async (req, res) => {
  const password = req.headers["x-educator-password"] as string | undefined;
  if (password !== getEducatorPassword()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const grade = req.query["grade"] as string | undefined;

    const allConvs = await db
      .select({ id: conversations.id, grade: conversations.grade })
      .from(conversations)
      .where(eq(conversations.role, "learner"));

    const filteredIds = grade
      ? allConvs.filter((c) => c.grade === grade).map((c) => c.id)
      : allConvs.map((c) => c.id);

    if (filteredIds.length === 0) {
      res.json([]);
      return;
    }

    const allMessages = await db
      .select({
        content: messages.content,
        createdAt: messages.createdAt,
        conversationId: messages.conversationId,
      })
      .from(messages)
      .where(eq(messages.role, "user"))
      .orderBy(desc(messages.createdAt))
      .limit(100);

    const filtered = allMessages
      .filter((m) => filteredIds.includes(m.conversationId))
      .slice(0, 40);

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to get trending questions");
    res.status(500).json({ error: "Failed to get trending questions" });
  }
});

// ─── Resources (public read) ─────────────────────────────────────────────────

router.get("/resources", async (req, res) => {
  try {
    const grade = req.query["grade"] as string | undefined;
    const subject = req.query["subject"] as string | undefined;

    const all = await db
      .select({
        id: resources.id,
        title: resources.title,
        subject: resources.subject,
        grade: resources.grade,
        mimeType: resources.mimeType,
        fileName: resources.fileName,
        uploadedBy: resources.uploadedBy,
        description: resources.description,
        createdAt: resources.createdAt,
      })
      .from(resources)
      .orderBy(desc(resources.createdAt));

    const filtered = all.filter((r) => {
      if (grade && r.grade && r.grade !== grade) return false;
      if (subject && r.subject !== subject) return false;
      return true;
    });

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list resources");
    res.status(500).json({ error: "Failed to list resources" });
  }
});

router.get("/resources/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    res.json(resource);
  } catch (err) {
    req.log.error({ err }, "Failed to get resource");
    res.status(500).json({ error: "Failed to get resource" });
  }
});

// ─── Resources (educator-protected write) ────────────────────────────────────

router.post("/educator/resources", async (req, res) => {
  const password = req.headers["x-educator-password"] as string | undefined;
  if (password !== getEducatorPassword()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { title, subject, grade, mimeType, fileName, fileData, uploadedBy, description } =
      req.body as {
        title: string;
        subject: string;
        grade?: string | null;
        mimeType: string;
        fileName?: string | null;
        fileData: string;
        uploadedBy: string;
        description?: string | null;
      };

    if (!title || !fileData || !uploadedBy) {
      res.status(400).json({ error: "title, fileData, and uploadedBy are required" });
      return;
    }

    const [resource] = await db
      .insert(resources)
      .values({
        title,
        subject: subject ?? "General",
        grade: grade ?? null,
        mimeType: mimeType ?? "text/plain",
        fileName: fileName ?? null,
        fileData,
        uploadedBy,
        description: description ?? null,
      })
      .returning();

    res.status(201).json(resource);
  } catch (err) {
    req.log.error({ err }, "Failed to create resource");
    res.status(500).json({ error: "Failed to create resource" });
  }
});

router.delete("/educator/resources/:id", async (req, res) => {
  const password = req.headers["x-educator-password"] as string | undefined;
  if (password !== getEducatorPassword()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    await db.delete(resources).where(eq(resources.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete resource");
    res.status(500).json({ error: "Failed to delete resource" });
  }
});

// ─── Conversations ────────────────────────────────────────────────────────────

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
    const { title, role, grade } = req.body as { title: string; role: string; grade?: string };
    if (!title || !role) {
      res.status(400).json({ error: "title and role are required" });
      return;
    }
    const [conv] = await db
      .insert(conversations)
      .values({ title, role, grade: grade ?? null })
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
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
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
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
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

// ─── Send Message (SSE, supports image/document) ─────────────────────────────

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    const {
      content,
      imageBase64,
      imageMimeType,
      userName,
    } = req.body as {
      content: string;
      imageBase64?: string;
      imageMimeType?: string;
      userName?: string;
    };

    if (!content && !imageBase64) {
      res.status(400).json({ error: "content or imageBase64 is required" });
      return;
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const displayContent = content || "[Image shared]";
    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content: displayContent,
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

    const name = userName ?? "there";
    const systemPrompt = buildSystemPrompt(conv.role ?? "parent", name, conv.grade);

    const ai = getAI();
    let fullResponse = "";

    // Build message contents — all history is text, latest may have an image
    const historyMessages = chatHistory.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : ("user" as const),
      parts: [{ text: m.content }],
    }));

    // Build the latest user message parts
    type GeminiPart =
      | { text: string }
      | { inlineData: { mimeType: string; data: string } };

    const latestParts: GeminiPart[] = [];
    if (content) latestParts.push({ text: content });
    if (imageBase64 && imageMimeType) {
      latestParts.push({
        inlineData: { mimeType: imageMimeType, data: imageBase64 },
      });
    }
    if (latestParts.length === 0) latestParts.push({ text: displayContent });

    const allContents = [
      ...historyMessages,
      { role: "user" as const, parts: latestParts },
    ];

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 8192,
      },
      contents: allContents,
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
