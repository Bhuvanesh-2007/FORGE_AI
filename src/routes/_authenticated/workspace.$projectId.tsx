import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowLeft, Loader2 } from "lucide-react";
import type { UIMessage } from "ai";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { ChatPane } from "@/components/workspace/ChatPane";
import { PreviewPane, type PreviewHandle } from "@/components/workspace/PreviewPane";
import { CodePane } from "@/components/workspace/CodePane";
import { EditToolbar } from "@/components/workspace/EditToolbar";
import { useWorkspaceStore } from "@/lib/workspace-store";
import type { EditableInfo, EditablePatch } from "@/lib/preview-inject";
import { supabase } from "@/integrations/supabase/client";
import {
  getProject,
  listProjectFiles,
  listChatMessages,
  saveProjectFile,
} from "@/lib/projects.functions";
import { listPatches, upsertPatch } from "@/lib/edits.functions";

export const Route = createFileRoute("/_authenticated/workspace/$projectId")({
  head: () => ({ meta: [{ title: `Workspace — Forge` }] }),
  component: Workspace,
});

function Workspace() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const getP = useServerFn(getProject);
  const listF = useServerFn(listProjectFiles);
  const listM = useServerFn(listChatMessages);
  const saveF = useServerFn(saveProjectFile);
  const listE = useServerFn(listPatches);
  const upsertE = useServerFn(upsertPatch);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { id: projectId } }),
  });

  const files = useQuery({
    queryKey: ["project-files", projectId],
    queryFn: () => listF({ data: { projectId } }),
  });

  const messages = useQuery({
    queryKey: ["chat-messages", projectId],
    queryFn: () => listM({ data: { projectId } }),
  });

  const patches = useQuery({
    queryKey: ["page-elements", projectId],
    queryFn: () => listE({ data: { projectId } }),
  });

  const setFiles = useWorkspaceStore((s) => s.setFiles);
  const wsFiles = useWorkspaceStore((s) => s.files);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const setActivePath = useWorkspaceStore((s) => s.setActivePath);
  const device = useWorkspaceStore((s) => s.device);
  const setDevice = useWorkspaceStore((s) => s.setDevice);
  const editMode = useWorkspaceStore((s) => s.editMode);
  const setEditMode = useWorkspaceStore((s) => s.setEditMode);
  const wsPatches = useWorkspaceStore((s) => s.patches);
  const setPatches = useWorkspaceStore((s) => s.setPatches);
  const mergePatch = useWorkspaceStore((s) => s.mergePatch);
  const removePatch = useWorkspaceStore((s) => s.removePatch);
  const pulseId = useWorkspaceStore((s) => s.pulseId);
  const setPulseId = useWorkspaceStore((s) => s.setPulseId);

  const previewRef = useRef<PreviewHandle>(null);
  const [clicked, setClicked] = useState<EditableInfo | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // Seed store from DB on load
  useEffect(() => {
    if (files.data) {
      setFiles(files.data.map((f) => ({ path: f.path, content: f.content })));
    }
  }, [files.data, setFiles]);

  useEffect(() => {
    if (patches.data) {
      setPatches(
        patches.data.map((r) => ({
          path: r.path,
          editable_id: r.editable_id,
          patch: (r.patch ?? {}) as EditablePatch,
        })),
      );
    }
  }, [patches.data, setPatches]);

  // Realtime: subscribe to page_elements changes for this project
  useEffect(() => {
    const channel = supabase
      .channel(`page_elements:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_elements", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = payload.old as { path?: string; editable_id?: string };
            if (row.path && row.editable_id) removePatch(row.path, row.editable_id);
          } else {
            const row = payload.new as { path: string; editable_id: string; patch: EditablePatch };
            mergePatch(row.path, row.editable_id, row.patch ?? {});
            // Pulse only for changes not originating from a direct manual click here
            setPulseId(row.editable_id);
            setTimeout(() => setPulseId(null), 1200);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, mergePatch, removePatch, setPulseId]);

  // Pulse ripple: dispatch pulse to preview when pulseId changes
  useEffect(() => {
    if (pulseId) previewRef.current?.pulse(pulseId);
  }, [pulseId]);

  const applyEdit = useCallback(
    async (path: string, editableId: string, patch: EditablePatch, opts?: { pulse?: boolean }) => {
      // 1. Optimistic local update + iframe patch
      mergePatch(path, editableId, patch);
      previewRef.current?.applyPatch(editableId, patch, { pulse: opts?.pulse });
      // 2. Persist. Realtime will re-broadcast; merged store handles idempotency.
      try {
        await upsertE({ data: { projectId, path, editableId, patch } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save edit");
      }
    },
    [projectId, mergePatch, upsertE],
  );

  const onElementClicked = useCallback((info: EditableInfo) => {
    const rect = previewRef.current?.getFrameRect() ?? null;
    setContainerRect(rect);
    setClicked(info);
  }, []);

  const initialMessages: UIMessage[] = messagesToUI(messages.data);
  const isLoading = project.isLoading || files.isLoading || messages.isLoading;
  const err = project.error ?? files.error ?? messages.error;

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">{err.message}</p>
        <button onClick={() => navigate({ to: "/dashboard" })} className="rounded-lg glass px-4 py-2 text-sm">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (isLoading || !project.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-glass-border/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <Logo size={22} />
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">{project.data.name}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {wsFiles.length} file{wsFiles.length === 1 ? "" : "s"} · Updated {new Date(project.data.updated_at).toLocaleTimeString()}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[380px_1fr_420px] overflow-hidden">
        <div className="border-r border-glass-border/60 overflow-hidden">
          <ChatPane projectId={projectId} initialMessages={initialMessages} applyEdit={applyEdit} />
        </div>
        <div className="overflow-hidden">
          <PreviewPane
            ref={previewRef}
            files={wsFiles}
            device={device}
            onDeviceChange={setDevice}
            activePath={activePath}
            patches={wsPatches}
            editMode={editMode}
            onEditModeChange={setEditMode}
            onElementClicked={onElementClicked}
          />
        </div>
        <div className="border-l border-glass-border/60 overflow-hidden">
          <CodePane
            files={wsFiles}
            activePath={activePath}
            onSelect={setActivePath}
            onSave={async (path, content) => {
              await saveF({ data: { projectId, path, content } });
              useWorkspaceStore.getState().writeFile(path, content);
            }}
          />
        </div>
      </div>

      {clicked && containerRect && (
        <EditToolbar
          info={clicked}
          containerRect={containerRect}
          onApply={(patch) => applyEdit(activePath, clicked.id, patch, { pulse: true })}
          onClose={() => setClicked(null)}
        />
      )}
    </div>
  );
}

function messagesToUI(rows: Array<{ id: string; role: string; parts: unknown; created_at: string }> | undefined): UIMessage[] {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: Array.isArray(r.parts) ? (r.parts as UIMessage["parts"]) : [],
  }));
}
