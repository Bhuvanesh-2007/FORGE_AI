import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug/env")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = request.headers.get("x-debug-token") || "";
          const secret = process.env.DEPLOY_DEBUG_TOKEN || "";
          if (!secret || token !== secret) return new Response("Unauthorized", { status: 401 });

          const payload = {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_PROJECT_ID: !!process.env.SUPABASE_PROJECT_ID,
            VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
            VITE_SUPABASE_PUBLISHABLE_KEY: !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
          };

          return new Response(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error('[debug/env] error', e);
          return new Response('Internal error', { status: 500 });
        }
      },
    },
  },
});
