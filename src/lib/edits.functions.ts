import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PatchSchema = z
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
  .strip();

export const listPatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("page_elements")
      .select("path, editable_id, patch, updated_at")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1).max(200),
        editableId: z.string().min(1).max(120),
        patch: PatchSchema,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    // merge existing patch + new patch so partial edits accumulate
    const { data: existing } = await context.supabase
      .from("page_elements")
      .select("patch")
      .eq("project_id", data.projectId)
      .eq("path", data.path)
      .eq("editable_id", data.editableId)
      .maybeSingle();
    const merged = { ...((existing?.patch as object | null) ?? {}), ...data.patch };
    const { error } = await context.supabase
      .from("page_elements")
      .upsert(
        {
          project_id: data.projectId,
          path: data.path,
          editable_id: data.editableId,
          patch: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,path,editable_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, patch: merged };
  });
