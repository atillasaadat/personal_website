// The site's single image viewer.
//
// Post figures, post galleries (built from runs of markdown images) and the
// AutoGallery component on /about and /research all open this same <dialog>,
// so a change to how images expand (zoom, navigation, captions, keys) applies
// everywhere at once. Styles live in src/styles/global.css under `.lightbox`,
// because the dialog is appended to <body> where Astro's scoped styles would
// not reach it.

export interface LightboxItem {
  src: string;
  caption?: string;
}

export interface LightboxOptions {
  // Called with the new index whenever the viewer navigates, so the gallery
  // that opened it can follow along and still be on that image once it closes.
  onChange?: (index: number) => void;
}

let items: LightboxItem[] = [];
let index = 0;
let onChange: ((index: number) => void) | undefined;

function build(): HTMLDialogElement {
  const dlg = document.createElement('dialog');
  dlg.id = 'lightbox';
  dlg.className = 'lightbox';
  dlg.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="Close">&times;</button>
    <button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">&lsaquo;</button>
    <button class="lightbox-nav lightbox-next" type="button" aria-label="Next image">&rsaquo;</button>
    <div class="lightbox-scroll"><img class="lightbox-img" alt="" /></div>
    <div class="lightbox-bar">
      <p class="lightbox-cap"></p>
      <p class="lightbox-hint"></p>
    </div>`;

  const scroll = dlg.querySelector('.lightbox-scroll') as HTMLElement;
  const img = dlg.querySelector('.lightbox-img') as HTMLImageElement;

  dlg.querySelector('.lightbox-close')!.addEventListener('click', () => dlg.close());
  dlg.querySelector('.lightbox-prev')!.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  dlg.querySelector('.lightbox-next')!.addEventListener('click', (e) => { e.stopPropagation(); step(1); });

  // Clicking the dark surround (anything but the image itself) closes.
  dlg.addEventListener('click', (e) => {
    if (e.target === img) return;
    if ((e.target as Element).closest('.lightbox-nav, .lightbox-close')) return;
    dlg.close();
  });

  // Click the image to toggle a 1:1 zoom, centred on the point clicked. Only
  // offered when the image actually has more detail than the fitted view.
  img.addEventListener('click', (e) => {
    if (!dlg.classList.contains('can-zoom')) return;
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const zoomed = dlg.classList.toggle('zoomed');
    if (zoomed) {
      scroll.scrollLeft = fx * img.naturalWidth - scroll.clientWidth / 2;
      scroll.scrollTop = fy * img.naturalHeight - scroll.clientHeight / 2;
    }
    renderHint();
  });

  // Arrow keys browse the set. Esc is handled natively by <dialog>.
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  });

  // Once the image is decoded we know whether 1:1 is bigger than the fit view.
  img.addEventListener('load', () => {
    dlg.classList.toggle('can-zoom', img.naturalWidth > img.clientWidth + 8);
    renderHint();
  });

  dlg.addEventListener('close', () => {
    dlg.classList.remove('zoomed', 'can-zoom');
    img.removeAttribute('src');
    document.body.style.overflow = '';
  });

  document.body.appendChild(dlg);
  return dlg;
}

function ensure(): HTMLDialogElement {
  // The dialog is appended to <body>, which ClientRouter replaces on
  // navigation, so re-create it whenever it has been swapped away.
  return (document.getElementById('lightbox') as HTMLDialogElement | null) ?? build();
}

function renderHint() {
  const dlg = document.getElementById('lightbox');
  if (!dlg) return;
  const parts: string[] = [];
  if (items.length > 1) parts.push(`${index + 1} / ${items.length}`, '← → to browse');
  if (dlg.classList.contains('can-zoom')) {
    parts.push(dlg.classList.contains('zoomed') ? 'Click image to fit' : 'Click image to zoom');
  }
  parts.push('Esc to close');
  (dlg.querySelector('.lightbox-hint') as HTMLElement).textContent = parts.join(' · ');
}

function render() {
  const dlg = ensure();
  const img = dlg.querySelector('.lightbox-img') as HTMLImageElement;
  const item = items[index];
  dlg.classList.remove('zoomed', 'can-zoom');
  img.src = item.src;
  img.alt = item.caption || '';
  const cap = dlg.querySelector('.lightbox-cap') as HTMLElement;
  cap.textContent = item.caption || '';
  cap.hidden = !item.caption;
  dlg.classList.toggle('has-nav', items.length > 1);
  renderHint();
}

function step(delta: number) {
  if (items.length < 2) return;
  index = (index + delta + items.length) % items.length;
  render();
  onChange?.(index);
}

/** Open the viewer on `list`, starting at `start`. */
export function openLightbox(list: LightboxItem[], start = 0, opts: LightboxOptions = {}) {
  if (!list.length) return;
  items = list;
  index = Math.min(Math.max(start, 0), list.length - 1);
  onChange = opts.onChange;
  const dlg = ensure();
  render();
  document.body.style.overflow = 'hidden';
  if (!dlg.open) dlg.showModal();
}

/**
 * Make `trigger` expand into the viewer on click. `resolve` is called at click
 * time (not bind time) so galleries can hand over whichever image they are
 * currently showing. Binding is idempotent, so callers may re-run on every
 * page view without stacking listeners.
 */
export function bindLightbox(
  trigger: HTMLElement,
  resolve: () => { items: LightboxItem[]; index: number } | null,
  opts: LightboxOptions = {},
) {
  if (trigger.dataset.lightboxBound) return;
  trigger.dataset.lightboxBound = '1';
  trigger.addEventListener('click', () => {
    const r = resolve();
    if (r) openLightbox(r.items, r.index, opts);
  });
}
