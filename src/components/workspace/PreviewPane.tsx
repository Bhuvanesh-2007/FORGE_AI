import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Monitor, Tablet, Smartphone, RefreshCw, ExternalLink, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectFile, PatchRow } from "@/lib/workspace-store";
import { injectPreviewRuntime, type EditableInfo, type EditablePatch } from "@/lib/preview-inject";

type Device = "desktop" | "tablet" | "mobile";
const DEVICES: Record<Device, { w: number | "100%"; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  desktop: { w: "100%", label: "Desktop", icon: Monitor },
  tablet: { w: 768, label: "Tablet", icon: Tablet },
  mobile: { w: 390, label: "Mobile", icon: Smartphone },
};

export type PreviewHandle = {
  applyPatch: (id: string, patch: EditablePatch, opts?: { pulse?: boolean }) => void;
  pulse: (id: string) => void;
  getFrameRect: () => DOMRect | null;
};

export const PreviewPane = forwardRef<
  PreviewHandle,
  {
    files: ProjectFile[];
    device: Device;
    onDeviceChange: (d: Device) => void;
    activePath: string;
    patches: PatchRow[];
    editMode: boolean;
    onEditModeChange: (on: boolean) => void;
    onElementClicked: (info: EditableInfo) => void;
  }
>(function PreviewPane(
  { files, device, onDeviceChange, activePath, patches, editMode, onEditModeChange, onElementClicked },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath) ?? files.find((f) => f.path === "index.html") ?? files[0],
    [files, activePath],
  );

  const srcDoc = useMemo(() => {
    if (!activeFile) {
      return `<!doctype html><html><body style="background:#0A0A0F;color:#888;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center"><div style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;opacity:.6">Empty project</div><div style="margin-top:8px">Send a prompt to generate your first page.</div></div></body></html>`;
    }
    return injectPreviewRuntime(activeFile.content);
  }, [activeFile]);

  // Reset ready flag whenever srcdoc changes (iframe reloads)
  useEffect(() => {
    readyRef.current = false;
  }, [srcDoc]);

  // Filter patches to the currently-rendered file
  const activePatches = useMemo(
    () => patches.filter((p) => p.path === (activeFile?.path ?? "index.html")),
    [patches, activeFile?.path],
  );

  const post = (msg: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: "forge-parent", ...msg }, "*");
  };

  // Listen for iframe ready + clicks
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; info?: EditableInfo } | undefined;
      if (!d || d.source !== "forge-preview") return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (d.type === "ready") {
        readyRef.current = true;
        post({ type: "setEditMode", on: editMode });
        post({ type: "hydratePatches", patches: activePatches });
      } else if (d.type === "element-clicked" && d.info) {
        onElementClicked(d.info);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [activePatches, editMode, onElementClicked]);

  // Sync edit mode to iframe
  useEffect(() => {
    if (readyRef.current) post({ type: "setEditMode", on: editMode });
  }, [editMode]);

  // Sync patches to iframe (re-hydrate full set — cheap, idempotent).
  useEffect(() => {
    if (readyRef.current) post({ type: "hydratePatches", patches: activePatches });
  }, [activePatches]);

  useImperativeHandle(ref, () => ({
    applyPatch: (id, patch, opts) => post({ type: "applyPatch", id, patch, pulse: opts?.pulse }),
    pulse: (id) => post({ type: "pulse", id }),
    getFrameRect: () => containerRef.current?.getBoundingClientRect() ?? null,
  }));

  const refresh = () => {
    const el = iframeRef.current;
    if (!el) return;
    const doc = el.srcdoc;
    el.srcdoc = "";
    requestAnimationFrame(() => { el.srcdoc = doc; });
  };

  const openExternal = () => {
    const blob = new Blob([srcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const frame = DEVICES[device];

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-glass-border/60 px-3 py-2">
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex rounded-lg glass p-0.5">
            {(Object.keys(DEVICES) as Device[]).map((d) => {
              const I = DEVICES[d].icon;
              return (
                <button
                  key={d}
                  onClick={() => onDeviceChange(d)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition",
                    device === d ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={DEVICES[d].label}
                >
                  <I className="size-3.5" />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onEditModeChange(!editMode)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition",
              editMode
                ? "bg-gradient-brand text-primary-foreground shadow-[0_0_20px_rgba(168,85,247,.35)]"
                : "glass text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={editMode}
            title={editMode ? "Exit edit mode" : "Click any element to edit it"}
          >
            <MousePointerClick className="size-3.5" />
            {editMode ? "Editing" : "Edit"}
          </button>
        </div>
        <div className="truncate px-3 text-xs text-muted-foreground">
          <span className="font-mono">/{activeFile?.path ?? "index.html"}</span>
        </div>
        <div className="inline-flex items-center gap-1">
          <button onClick={refresh} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground" aria-label="Refresh">
            <RefreshCw className="size-3.5" />
          </button>
          <button onClick={openExternal} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground" aria-label="Open in new tab">
            <ExternalLink className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex flex-1 items-start justify-center overflow-auto bg-[radial-gradient(circle_at_50%_0%,_oklch(0.14_0.02_270),_var(--background))] p-4"
      >
        <div
          className={cn(
            "h-full overflow-hidden rounded-xl border bg-white shadow-2xl transition-all",
            editMode ? "border-violet/60 shadow-[0_0_0_1px_rgba(168,85,247,.4),0_20px_60px_-15px_rgba(168,85,247,.35)]" : "border-glass-border",
          )}
          style={{ width: frame.w, maxWidth: "100%", height: "100%" }}
        >
          <iframe
            ref={iframeRef}
            title="Preview"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
});
