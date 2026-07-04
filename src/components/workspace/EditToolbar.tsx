import { useEffect, useRef, useState } from "react";
import { Type, Palette, Link as LinkIcon, Image as ImageIcon, X, Bold, Check } from "lucide-react";
import type { EditableInfo, EditablePatch } from "@/lib/preview-inject";
import { cn } from "@/lib/utils";

const SWATCHES = [
  "#ffffff", "#0A0A0F", "#a855f7", "#22d3ee", "#f97316",
  "#22c55e", "#ef4444", "#eab308", "#3b82f6", "#ec4899",
];

/**
 * Floating contextual edit toolbar. Rendered by the workspace when the preview
 * iframe reports an element-clicked event.
 */
export function EditToolbar({
  info,
  containerRect,
  onApply,
  onClose,
}: {
  info: EditableInfo;
  containerRect: DOMRect;
  onApply: (patch: EditablePatch) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(info.text ?? "");
  const [src, setSrc] = useState(info.src ?? "");
  const [href, setHref] = useState(info.href ?? "");
  const [mode, setMode] = useState<"main" | "color" | "bg" | "img" | "link">("main");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(info.text ?? "");
    setSrc(info.src ?? "");
    setHref(info.href ?? "");
    setMode("main");
  }, [info.id]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const isImg = info.tag === "img";
  const isLink = info.tag === "a";

  // Position: above the element, clamped to container.
  const top = Math.max(8, info.rect.top + containerRect.top - 52);
  const left = Math.max(8, Math.min(containerRect.right - 320, info.rect.left + containerRect.left));

  return (
    <div
      ref={rootRef}
      className="fixed z-50 rounded-xl border border-glass-border bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl"
      style={{ top, left, minWidth: 280, maxWidth: 380 }}
      onClick={(e) => e.stopPropagation()}
    >
      {mode === "main" && (
        <div className="flex items-center gap-1">
          {!isImg && (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onApply({ text });
                  onClose();
                }
              }}
              placeholder="Edit text…"
              className="min-w-0 flex-1 rounded-md bg-white/5 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-violet"
            />
          )}
          {isImg && (
            <button className="btn-chip" onClick={() => setMode("img")}>
              <ImageIcon className="size-3.5" /> Image
            </button>
          )}
          {!isImg && (
            <>
              <IconBtn label="Color" onClick={() => setMode("color")}><Palette className="size-3.5" /></IconBtn>
              <IconBtn label="Background" onClick={() => setMode("bg")}><div className="size-3.5 rounded-sm border border-white/40 bg-gradient-to-br from-violet to-cyan" /></IconBtn>
              <IconBtn label="Bold" onClick={() => onApply({ fontWeight: 700 })}><Bold className="size-3.5" /></IconBtn>
            </>
          )}
          {isLink && (
            <IconBtn label="Link" onClick={() => setMode("link")}><LinkIcon className="size-3.5" /></IconBtn>
          )}
          {!isImg && (
            <button
              onClick={() => { onApply({ text }); onClose(); }}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-brand px-2 py-1.5 text-xs text-primary-foreground"
            >
              <Check className="size-3.5" /> Save
            </button>
          )}
          <IconBtn label="Close" onClick={onClose}><X className="size-3.5" /></IconBtn>
        </div>
      )}
      {(mode === "color" || mode === "bg") && (
        <div className="space-y-2 p-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Type className="size-3" /> {mode === "color" ? "Text color" : "Background"}
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => { onApply(mode === "color" ? { color: c } : { bg: c }); onClose(); }}
                className="size-5 rounded-md border border-white/20 transition hover:scale-110"
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <input
            placeholder="#hex or css color"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) { onApply(mode === "color" ? { color: v } : { bg: v }); onClose(); }
              }
            }}
            className="w-full rounded-md bg-white/5 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet"
          />
        </div>
      )}
      {mode === "img" && (
        <div className="space-y-1.5 p-1">
          <input
            autoFocus
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder="Image URL (https://…)"
            className="w-full rounded-md bg-white/5 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet"
          />
          <button
            onClick={() => { if (src) onApply({ src }); onClose(); }}
            className="w-full rounded-md bg-gradient-brand px-2 py-1.5 text-xs text-primary-foreground"
          >
            Replace image
          </button>
        </div>
      )}
      {mode === "link" && (
        <div className="space-y-1.5 p-1">
          <input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md bg-white/5 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet"
          />
          <button
            onClick={() => { if (href) onApply({ href }); onClose(); }}
            className="w-full rounded-md bg-gradient-brand px-2 py-1.5 text-xs text-primary-foreground"
          >
            Set link
          </button>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn("inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/10 hover:text-foreground")}
    >
      {children}
    </button>
  );
}
