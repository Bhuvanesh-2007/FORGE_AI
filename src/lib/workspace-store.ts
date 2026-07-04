import { create } from "zustand";
import type { EditablePatch } from "@/lib/preview-inject";

export type ProjectFile = {
  path: string;
  content: string;
};

export type PatchRow = {
  path: string;
  editable_id: string;
  patch: EditablePatch;
};

type WorkspaceState = {
  files: ProjectFile[];
  activePath: string;
  device: "desktop" | "tablet" | "mobile";
  editMode: boolean;
  patches: PatchRow[]; // authoritative list keyed by (path, editable_id)
  chips: string[];
  pulseId: string | null;
  setFiles: (files: ProjectFile[]) => void;
  writeFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  setActivePath: (path: string) => void;
  setDevice: (d: "desktop" | "tablet" | "mobile") => void;
  setEditMode: (v: boolean) => void;
  setPatches: (rows: PatchRow[]) => void;
  mergePatch: (path: string, editableId: string, patch: EditablePatch) => void;
  removePatch: (path: string, editableId: string) => void;
  setChips: (chips: string[]) => void;
  setPulseId: (id: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  files: [],
  activePath: "index.html",
  device: "desktop",
  editMode: false,
  patches: [],
  chips: [],
  pulseId: null,
  setFiles: (files) =>
    set((s) => ({
      files,
      activePath: files.some((f) => f.path === s.activePath)
        ? s.activePath
        : files.find((f) => f.path === "index.html")?.path ?? files[0]?.path ?? "index.html",
    })),
  writeFile: (path, content) =>
    set((s) => {
      const existing = s.files.find((f) => f.path === path);
      const files = existing
        ? s.files.map((f) => (f.path === path ? { ...f, content } : f))
        : [...s.files, { path, content }].sort((a, b) => a.path.localeCompare(b.path));
      const activePath = s.activePath || path;
      return { files, activePath: files.some((f) => f.path === activePath) ? activePath : path };
    }),
  deleteFile: (path) =>
    set((s) => {
      const files = s.files.filter((f) => f.path !== path);
      const activePath = s.activePath === path ? files[0]?.path ?? "index.html" : s.activePath;
      return { files, activePath };
    }),
  setActivePath: (path) => set({ activePath: path }),
  setDevice: (device) => set({ device }),
  setEditMode: (v) => set({ editMode: v }),
  setPatches: (rows) => set({ patches: rows }),
  mergePatch: (path, editableId, patch) =>
    set((s) => {
      const idx = s.patches.findIndex((p) => p.path === path && p.editable_id === editableId);
      if (idx === -1) return { patches: [...s.patches, { path, editable_id: editableId, patch }] };
      const next = s.patches.slice();
      next[idx] = { ...next[idx], patch: { ...next[idx].patch, ...patch } };
      return { patches: next };
    }),
  removePatch: (path, editableId) =>
    set((s) => ({ patches: s.patches.filter((p) => !(p.path === path && p.editable_id === editableId)) })),
  setChips: (chips) => set({ chips }),
  setPulseId: (id) => set({ pulseId: id }),
}));
