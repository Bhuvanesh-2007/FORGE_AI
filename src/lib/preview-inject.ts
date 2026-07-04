/**
 * Runtime injected into every preview iframe. Tags editable elements with a
 * stable `data-editable-id`, forwards click/hover events to the parent via
 * postMessage, and applies incoming patches without reloading the page.
 */
export const PREVIEW_RUNTIME = `
<script>(function(){
  var TAGS = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LI','IMG','BLOCKQUOTE'];
  var editMode = false;
  var hoverEl = null;
  var hoverBox = document.createElement('div');
  hoverBox.setAttribute('data-forge-ui','1');
  hoverBox.style.cssText='position:fixed;pointer-events:none;border:2px solid #a855f7;border-radius:6px;box-shadow:0 0 0 4px rgba(168,85,247,.18);z-index:2147483647;transition:top 90ms ease-out,left 90ms ease-out,width 90ms ease-out,height 90ms ease-out;display:none;';

  function tag(){
    var counts = {};
    var nodes = document.querySelectorAll(TAGS.join(','));
    for (var i=0;i<nodes.length;i++){
      var el = nodes[i];
      if (el.closest('[data-forge-ui]')) continue;
      if (el.hasAttribute('data-editable-id')) continue;
      var t = el.tagName.toLowerCase();
      counts[t] = (counts[t]||0)+1;
      el.setAttribute('data-editable-id', t+'-'+counts[t]);
    }
  }

  function applyPatch(id, patch){
    if (!patch) return;
    var el = document.querySelector('[data-editable-id="'+id+'"]');
    if (!el) return;
    if (patch.text != null && el.tagName !== 'IMG') el.textContent = patch.text;
    if (patch.color) el.style.color = patch.color;
    if (patch.bg) el.style.backgroundColor = patch.bg;
    if (patch.fontWeight) el.style.fontWeight = String(patch.fontWeight);
    if (patch.fontSize) el.style.fontSize = patch.fontSize;
    if (patch.src && el.tagName === 'IMG') el.setAttribute('src', patch.src);
    if (patch.alt != null && el.tagName === 'IMG') el.setAttribute('alt', patch.alt);
    if (patch.href && el.tagName === 'A') el.setAttribute('href', patch.href);
    if (patch.hidden) el.style.display = 'none';
  }

  function pulse(id){
    var el = document.querySelector('[data-editable-id="'+id+'"]');
    if (!el) return;
    var prevSh = el.style.boxShadow, prevT = el.style.transition;
    el.style.transition = 'box-shadow 220ms ease-out';
    el.style.boxShadow = '0 0 0 4px rgba(168,85,247,.6)';
    setTimeout(function(){ el.style.boxShadow = prevSh; setTimeout(function(){ el.style.transition = prevT; }, 260); }, 900);
  }

  function info(el){
    var r = el.getBoundingClientRect();
    return {
      id: el.getAttribute('data-editable-id'),
      tag: el.tagName.toLowerCase(),
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      text: el.tagName === 'IMG' ? null : (el.textContent || '').trim().slice(0, 500),
      src: el.tagName === 'IMG' ? el.getAttribute('src') : null,
      href: el.tagName === 'A' ? el.getAttribute('href') : null,
      color: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    };
  }

  document.addEventListener('mousemove', function(e){
    if (!editMode) return;
    var el = e.target && e.target.closest ? e.target.closest('[data-editable-id]') : null;
    if (el === hoverEl) return;
    hoverEl = el;
    if (!el){ hoverBox.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    hoverBox.style.display = 'block';
    hoverBox.style.top = r.top + 'px';
    hoverBox.style.left = r.left + 'px';
    hoverBox.style.width = r.width + 'px';
    hoverBox.style.height = r.height + 'px';
  }, true);

  document.addEventListener('click', function(e){
    if (!editMode) return;
    var el = e.target && e.target.closest ? e.target.closest('[data-editable-id]') : null;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    parent.postMessage({ source: 'forge-preview', type: 'element-clicked', info: info(el) }, '*');
  }, true);

  document.addEventListener('submit', function(e){ if (editMode) e.preventDefault(); }, true);

  window.addEventListener('message', function(e){
    var d = e.data;
    if (!d || d.source !== 'forge-parent') return;
    if (d.type === 'setEditMode'){
      editMode = !!d.on;
      hoverBox.style.display = 'none';
      document.documentElement.style.cursor = editMode ? 'crosshair' : '';
    } else if (d.type === 'hydratePatches'){
      (d.patches || []).forEach(function(p){ applyPatch(p.editable_id, p.patch); });
    } else if (d.type === 'applyPatch'){
      applyPatch(d.id, d.patch);
      if (d.pulse) pulse(d.id);
    } else if (d.type === 'pulse'){
      pulse(d.id);
    } else if (d.type === 'rescroll'){
      var el = document.querySelector('[data-editable-id="'+d.id+'"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  function boot(){
    if (!document.body) { setTimeout(boot, 20); return; }
    if (!hoverBox.parentNode) document.body.appendChild(hoverBox);
    tag();
    parent.postMessage({ source: 'forge-preview', type: 'ready' }, '*');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();</script>
`;

export type EditablePatch = {
  text?: string;
  color?: string;
  bg?: string;
  fontWeight?: string | number;
  fontSize?: string;
  src?: string;
  alt?: string;
  href?: string;
  hidden?: boolean;
};

export type EditableInfo = {
  id: string;
  tag: string;
  rect: { top: number; left: number; width: number; height: number };
  text: string | null;
  src: string | null;
  href: string | null;
  color: string;
  bg: string;
};

export function injectPreviewRuntime(html: string): string {
  if (!html) return html;
  if (html.includes("</body>")) return html.replace("</body>", `${PREVIEW_RUNTIME}</body>`);
  return html + PREVIEW_RUNTIME;
}
