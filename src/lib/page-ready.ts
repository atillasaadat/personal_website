// Run a per-page enhancement as soon as the page's DOM is ready, on the
// first visit and after every client-side navigation (ClientRouter).
//
// Astro's own `astro:page-load` only fires after the window `load` event on
// the initial visit, i.e. after every image, video, and embed has finished
// downloading. On a slow connection that held back everything registered on
// it (post galleries, the globe's lazy-loader, card videos) for seconds even
// though they only need the DOM. So: on the initial visit run at
// DOMContentLoaded (or immediately if the DOM is already parsed, which is
// also the case when this module is first loaded by a client-side
// navigation, after the new DOM has been swapped in) and skip the
// `astro:page-load` that follows it; later navigations fire only
// `astro:page-load`, which runs promptly after the swap.
export function onPageReady(fn: () => void) {
  let skipNext = false;
  const runNow = () => { skipNext = true; fn(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runNow, { once: true });
  } else {
    runNow();
  }
  document.addEventListener('astro:page-load', () => {
    if (skipNext) { skipNext = false; return; }
    fn();
  });
}
