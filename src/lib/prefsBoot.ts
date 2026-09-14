/**
 * Applies this browser's accessibility preferences before the first paint.
 *
 * Kept apart from `lib/prefs` because the root layout is a server component and
 * must not import a module that pulls in client hooks. Without it, a page would
 * render with full motion and normal contrast, then flick into the chosen ones.
 */
export const PREFS_BOOT =
  'try{var p=JSON.parse(localStorage.getItem("cf_prefs")||"{}"),d=document.documentElement;if(p.reduceMotion)d.dataset.motion="reduce";if(p.moreContrast)d.dataset.contrast="more"}catch(e){}';
