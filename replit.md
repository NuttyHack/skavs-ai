# SKAVS — Hoye Secondary School AI Assistant

An AI-powered mobile assistant for Hoye Secondary School that serves three user roles: Learners (Socratic tutor), Educators (lesson architect), and Parents/Guardians (instant school info officer).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `GEMINI_API_KEY` — Google Gemini API key for AI chat

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with expo-router
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (`conversations`, `messages` tables)
- AI: Google Gemini 2.5 Flash via `@google/genai` SDK
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/` — Expo mobile app
  - `app/index.tsx` — Context gate (name + role selection)
  - `app/(main)/chat.tsx` — Chat screen with SSE streaming
  - `context/SessionContext.tsx` — User session (name, role) via AsyncStorage
  - `constants/colors.ts` — Dark navy theme tokens
- `artifacts/api-server/src/routes/gemini/` — Gemini AI chat routes
- `lib/db/src/schema/conversations.ts` — Conversations table (id, title, role, createdAt)
- `lib/db/src/schema/messages.ts` — Messages table
- `lib/api-spec/openapi.yaml` — API contract (source of truth)

## Architecture decisions

- Each conversation stores the user role (`learner` | `educator` | `parent`) so the backend can apply the correct system prompt without the client resending it.
- SSE streaming for AI responses — client uses `expo/fetch` with `getReader()` for cross-platform stream support.
- Socratic constraint enforced at the system prompt level for learner role — no direct homework answers.
- Session (name + role) stored in AsyncStorage for persistence across app restarts.
- Gemini 2.5 Flash used for cost/speed balance; system prompts are role-differentiated server-side.

## Product

- **Learner Chamber**: Socratic AI tutor that guides students to answers through hints and questions, never giving direct homework solutions.
- **Educator Chamber**: Lesson blueprint generator producing 45-min structured plans (hook → mechanics → review) plus pacing schedules.
- **Parent Chamber**: Instant answers about registration, uniforms, fees, calendar, and school policies — formatted for low-bandwidth mobile.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing DB schema, always run `pnpm --filter @workspace/db run push` then `pnpm run typecheck:libs` before API server typecheck.
- `@google/genai` must be in `artifacts/api-server/package.json` dependencies directly (not just via the integrations-gemini-ai lib) because the route imports it directly.
- SSE endpoint cannot have a typed Orval hook — consume with raw `fetch` + `ReadableStream` on the client.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
