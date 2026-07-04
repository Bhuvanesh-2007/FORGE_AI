import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createOpenAIProvider } from "@/lib/ai-gateway.server";
import { FORGE_SYSTEM_PROMPT, creativeSeedPrompt } from "@/lib/generation-system-prompt";

type IncomingBody = {
  messages?: UIMessage[];
  projectId?: string;
  files?: Array<{ path: string; content: string }>;
  model?: string;
};

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as IncomingBody;
        const messages = body.messages;
        const projectId = body.projectId;

        if (!Array.isArray(messages) || !projectId) {
          return new Response("messages and projectId required", { status: 400 });
        }

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
            },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const { data: proj } = await supabase
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .maybeSingle();
        if (!proj) return new Response("Project not found", { status: 404 });

        // Persist the latest user message.
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await supabase.from("chat_messages").insert({
            project_id: projectId,
            role: "user",
            parts: lastUser.parts as unknown as object,
          });
        }

        const fileList = (body.files ?? []).map((f) => `- ${f.path} (${f.content.length} chars)`).join("\n") || "(empty project)";
        const contextSystem = `Current virtual filesystem for project ${projectId}:\n${fileList}\n\nWhen editing, only rewrite files you actually change. Prefer edit_element for single-element tweaks.`;

        // Fresh-generation seed injected only when the project has no files yet.
        const isFreshGeneration = !body.files || body.files.length === 0;
        const seedBlock = isFreshGeneration ? `\n\n${creativeSeedPrompt()}` : "";

        const openai = createOpenAIProvider(key);
        const modelName = body.model || "gpt-4o";
        const model = openai(modelName);

        const tools = {
          write_file: tool({
            description: "Create or overwrite a file in the project's virtual filesystem. Use for all HTML/CSS/JS content.",
            inputSchema: z.object({
              path: z.string().min(1).max(200),
              content: z.string(),
            }),
            execute: async ({ path, content }) => {
              const { error } = await supabase.from("project_files").upsert(
                { project_id: projectId, path, content, updated_at: new Date().toISOString() },
                { onConflict: "project_id,path" },
              );
              if (error) return { ok: false, path, error: error.message };
              // Rewriting a file invalidates its element patches (structure changed).
              await supabase.from("page_elements").delete().eq("project_id", projectId).eq("path", path);
              return { ok: true, path, bytes: content.length };
            },
          }),
          delete_file: tool({
            description: "Delete a file from the project.",
            inputSchema: z.object({ path: z.string().min(1).max(200) }),
            execute: async ({ path }) => {
              const { error } = await supabase
                .from("project_files")
                .delete()
                .eq("project_id", projectId)
                .eq("path", path);
              if (error) return { ok: false, path, error: error.message };
              await supabase.from("page_elements").delete().eq("project_id", projectId).eq("path", path);
              return { ok: true, path };
            },
          }),
          edit_element: tool({
            description:
              "Patch a single already-rendered element in-place. Use for scoped edits: color, text, image src, link, font weight, hidden. Do NOT use for adding new sections — use write_file for structural changes.",
            inputSchema: z.object({
              path: z.string().min(1).max(200).describe("File path, usually 'index.html'"),
              editableId: z
                .string()
                .min(1)
                .max(120)
                .describe("The data-editable-id of the element, e.g. 'h1-1' or 'button-3'"),
              patch: z
                .object({
                  text: z.string().max(4000).optional(),
                  color: z.string().max(60).optional(),
                  bg: z.string().max(60).optional(),
                  fontWeight: z.union([z.string(), z.number()]).optional(),
                  fontSize: z.string().max(20).optional(),
                  src: z.string().max(2000).optional(),
                  alt: z.string().max(400).optional(),
                  href: z.string().max(2000).optional(),
                  hidden: z.boolean().optional(),
                })
                .describe("Only include fields that change."),
            }),
            execute: async ({ path, editableId, patch }) => {
              const { data: existing } = await supabase
                .from("page_elements")
                .select("patch")
                .eq("project_id", projectId)
                .eq("path", path)
                .eq("editable_id", editableId)
                .maybeSingle();
              const merged = { ...((existing?.patch as object | null) ?? {}), ...patch };
              const { error } = await supabase.from("page_elements").upsert(
                {
                  project_id: projectId,
                  path,
                  editable_id: editableId,
                  patch: merged,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "project_id,path,editable_id" },
              );
              if (error) return { ok: false, error: error.message };
              return { ok: true, path, editableId, patch: merged };
            },
          }),
          suggest_chips: tool({
            description:
              "Render 3–4 short tappable follow-up suggestions above the chat input. Use when the user is vague or dissatisfied.",
            inputSchema: z.object({
              chips: z.array(z.string().min(1).max(60)).min(2).max(6),
            }),
            execute: async ({ chips }) => ({ ok: true, chips }),
          }),
          chat_message: tool({
            description:
              "Send a short markdown message to the user summarising what you built or changed. Call at most once per turn, at the end.",
            inputSchema: z.object({ markdown: z.string().min(1).max(2000) }),
            execute: async ({ markdown }) => ({ ok: true, markdown }),
          }),
        };

        const result = streamText({
          model,
          system: `${FORGE_SYSTEM_PROMPT}\n\n${contextSystem}${seedBlock}`,
          messages: convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
          onFinish: async ({ response }) => {
            try {
              const lastAssistant = response.messages.filter((m) => m.role === "assistant").pop();
              if (lastAssistant) {
                await supabase.from("chat_messages").insert({
                  project_id: projectId,
                  role: "assistant",
                  parts: lastAssistant.content as unknown as object,
                });
              }
              await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);

              const { data: files } = await supabase
                .from("project_files")
                .select("path, content")
                .eq("project_id", projectId);
              await supabase.from("checkpoints").insert({
                project_id: projectId,
                summary: null,
                files_snapshot: files ?? [],
              });
            } catch (e) {
              console.error("[generate] persist failed", e);
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
