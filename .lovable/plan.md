# Forge — AI Website Builder MVP

A Lovable/Bolt-class product built on the existing TanStack Start + React 19 + Tailwind v4 stack, using Lovable Cloud (auth + Postgres) and Lovable AI Gateway (Gemini/Claude-class models) for generation.

## Scope of this plan

This is a very large product. I will deliver it in one continuous build, but grouped into 4 phases so you can steer between them. Each phase leaves the app in a working, demoable state.

## Design system (applied from Phase 1)

- **Theme**: near-black base `#0A0A0F`, glass panels (`backdrop-blur-xl` + 4–8% white overlays), single accent gradient **electric violet → cyan** used only on CTAs / active states.
- **Type**: Geist Sans (UI) + Geist Mono (code) via `@fontsource-variable/geist` + `@fontsource-variable/geist-mono`. Display headline uses tight tracking, 5xl–7xl.
- **Motion**: Framer Motion, 150–300ms ease-out. Streaming text token-by-token. Animated gradient border on the prompt box while generating.
- **3D hero**: React Three Fiber particle field on the landing page only, `prefers-reduced-motion` respected.
- Tokens defined in `src/styles.css` as oklch semantic variables — no hardcoded colors in components.

---

## Phase 1 — Landing + Auth + Dashboard

**Landing (`/`)**
- R3F animated particle-field hero with the prompt box centered ("Describe the site you want to build…").
- Sections: live demo (types a prompt → streams a mock preview), Features, Comparison table (Forge vs Lovable / Bolt / Bubble / Base44), Pricing (Free / Pro / Team), Footer.
- Real `head()` metadata; separate routes for `/pricing`, `/templates`, `/changelog`.

**Auth (`/auth`)**
- Lovable Cloud: email/password + Google. Glass modal styling. Redirect to `/dashboard` on success.
- `_authenticated` layout gate for protected routes.

**Dashboard (`/dashboard`)**
- Pinned prompt bar at top ("Start a new project…") → creates a project row and navigates to `/workspace/$projectId`.
- Grid of project cards showing name, updated-at, and a rendered thumbnail (last generated HTML rendered into an `<iframe srcdoc>` at scale).

---

## Phase 2 — Workspace + AI Generation (the core)

**Route**: `/workspace/$projectId` — 3-pane resizable layout using `react-resizable-panels`.

**Left: Chat pane**
- AI Elements composition (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Tool`, `Shimmer`).
- Threaded per project. Messages persisted to Cloud.
- Pinned prompt input at bottom with model selector (Gemini 3 Flash default; Gemini 3 Pro option).

**Center: Live preview pane**
- Device-frame toggle: mobile 375 / tablet 768 / desktop 100%.
- Renders the generated project into an `<iframe sandbox="allow-scripts" srcdoc={compiledHtml}>`.
- Refresh, open-in-new-tab, and console tabs.
- **Preview engine**: Sandpack is not reliable in this sandboxed environment, and WebContainers require cross-origin-isolation headers we don't control. Instead the generator emits **self-contained HTML+Tailwind (CDN) + inline JS** per page, which renders instantly in `srcdoc` with true hot-reload on every streamed diff. This matches Bolt's UX for the marketing/SaaS/landing-style outputs Forge targets first. (WebContainer/Node app support is a Phase 4 stretch — flagged below.)

**Right: Code + File Tree pane**
- File tree from the project's virtual FS.
- Monaco Editor (`@monaco-editor/react`) with Geist Mono, dark theme matching Forge palette.
- Manual edits sync back into the AI's context as a "user edited these files" system note on the next turn.

**Generation architecture**
- Server route `src/routes/api/generate.ts` streams via AI SDK `streamText` + `toUIMessageStreamResponse`.
- Provider: Lovable AI Gateway helper (`src/lib/ai-gateway.server.ts`), model `google/gemini-3-flash-preview` default.
- **Structured file-diff protocol**: model responds with tool calls `write_file({path, content})`, `delete_file({path})`, `chat_message({markdown})`. Rendered as `<Tool>` accordions in chat; applied to the project's virtual FS as they stream.
- **System prompt** pins: dark glass design tokens, shadcn-style patterns, small files, self-contained HTML, no placeholders. Full spec from Section 7 of your brief.
- Intent classification (`new project | edit | question`) is a first tool call so edits emit diffs against existing files rather than rewriting.
- `stopWhen: stepCountIs(50)`.
- 402/429 surfaced as toasts with clear CTAs.

---

## Phase 3 — Checkpoints + Templates + Export

- **Checkpoints**: every assistant turn creates a `checkpoints` row snapshotting the full virtual FS as JSONB. Sidebar drawer lists them with timestamp + summary; "Restore" reverts the project files atomically. Visual file-diff on hover (added/removed/modified counts).
- **Templates gallery** (`/templates`): 6 seeded starters (SaaS landing, portfolio, dashboard, blog, e-commerce, docs). "Use template" clones files into a new project.
- **Export**: "Download .zip" server function that zips the virtual FS via `jszip`.

---

## Phase 4 — Deploy + Billing + Teams (stretch)

- **Deploy**: publish the project's compiled HTML to a Cloud Storage bucket, expose at `forge.app/p/$slug` via a public route. (GitHub push + Vercel deploy is documented as a follow-up requiring the user's GitHub token.)
- **Billing**: Stripe subscriptions (Free 20 generations/mo, Pro unlimited, Team) — requires you to add the Stripe secret; scaffolded but disabled until then.
- **Teams**: `organizations` + `organization_members` + role-based RLS on projects.
- **WebContainers escape hatch**: for users who need real Node/npm, add a "Boot dev server" button that loads `@webcontainer/api`. Only works when the deployed Forge site serves COOP/COEP headers — documented, feature-flagged.

---

## Technical details

**Data model (Lovable Cloud / Postgres)**
```
profiles              (id → auth.users, display_name, avatar_url)
projects              (id, owner_id, name, slug, created_at, updated_at)
project_files         (id, project_id, path, content, updated_at)  -- virtual FS
chat_messages         (id, project_id, role, parts jsonb, created_at)
checkpoints           (id, project_id, summary, files_snapshot jsonb, created_at)
user_roles            (id, user_id, role app_role)  -- for admin/team gating
```
All tables scoped by `owner_id` / membership with RLS + explicit `GRANT`s to `authenticated` + `service_role`. `has_role()` security-definer function for admin checks.

**Server surfaces**
- `createServerFn` for CRUD (projects, files, checkpoints, messages).
- `src/routes/api/generate.ts` server route for streaming chat (needs raw `Response`).
- All protected fns use `requireSupabaseAuth` middleware; bearer attached via `src/start.ts` middleware.

**Key packages to add**
`@ai-sdk/react`, `ai`, `@ai-sdk/openai-compatible`, `@monaco-editor/react`, `monaco-editor`, `react-resizable-panels`, `three`, `@react-three/fiber`, `@react-three/drei`, `framer-motion`, `zustand`, `jszip`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, AI Elements (`conversation message prompt-input tool shimmer`).

**Routes**
```
/                          landing
/pricing, /templates, /changelog
/auth
/_authenticated/dashboard
/_authenticated/workspace/$projectId
/_authenticated/settings
/p/$slug                   published projects (Phase 4)
```

**Non-goals for this MVP**
- Real GitHub push / Vercel API deploy (documented follow-up).
- Full Node.js WebContainer previews (Phase 4 stretch, feature-flagged).
- Stripe live billing (scaffolded, activates once you add the secret).

---

## Build order

1. Enable Lovable Cloud, provision `LOVABLE_API_KEY`, migrate schema + RLS + grants.
2. Design tokens in `src/styles.css`, fonts, base layout primitives.
3. Landing + `/pricing` + `/templates` + auth + dashboard (Phase 1).
4. Workspace 3-pane shell, virtual FS wiring, Monaco, iframe preview (Phase 2 scaffold).
5. Generation server route + AI SDK tools + streaming diff applier (Phase 2 core).
6. Checkpoints + templates + export (Phase 3).
7. Deploy + billing + teams scaffolding (Phase 4).

I'll pause after Phase 2 to let you try it end-to-end before continuing into 3 and 4.