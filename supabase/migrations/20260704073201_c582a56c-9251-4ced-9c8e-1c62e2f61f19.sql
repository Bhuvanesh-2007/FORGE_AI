
CREATE TABLE public.page_elements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  editable_id TEXT NOT NULL,
  patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, path, editable_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_elements TO authenticated;
GRANT ALL ON public.page_elements TO service_role;

ALTER TABLE public.page_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads elements" ON public.page_elements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = page_elements.project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owner writes elements" ON public.page_elements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = page_elements.project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owner updates elements" ON public.page_elements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = page_elements.project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owner deletes elements" ON public.page_elements FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = page_elements.project_id AND p.owner_id = auth.uid()));

CREATE INDEX idx_page_elements_project_path ON public.page_elements (project_id, path);

ALTER TABLE public.page_elements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_elements;
