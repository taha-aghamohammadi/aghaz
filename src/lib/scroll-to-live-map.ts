/** Sticky header height + small gap so the live map title stays visible. */
const LIVE_MAP_SCROLL_OFFSET = 88;

export const LIVE_MAP_SECTION_ID = "desks";

/** Smooth scroll to the live desk map section on the landing page. */
export function scrollToLiveMap() {
  const el = document.getElementById(LIVE_MAP_SECTION_ID);
  if (!el) return;

  const top = el.getBoundingClientRect().top + window.scrollY - LIVE_MAP_SCROLL_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
