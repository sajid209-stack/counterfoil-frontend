/**
 * Applies this browser's accessibility preferences before the first paint.
 *
 * Kept apart from `lib/prefs` because the root layout is a server component and
 * must not import a module that pulls in client hooks. Without it, a page would
 * render with full motion and normal contrast, then flick into the chosen ones.
 */

/**
 * The routes the till's text size applies to.
 *
 * It is a TILL setting, not an app one: only the Go surface has been converted
 * off pixel font sizes, so only the Go surface scales completely. Scaling the
 * root font size everywhere would move the admin app's `rem` utilities and
 * leave its 840 pixel ones behind — "some screens and not others", which is
 * exactly why the September preferences work left text size out.
 *
 * Declared here so the boot script and `GoShell` read one list. Two copies of
 * this would drift, and the symptom would be a cold load at the wrong size.
 */
export const TILL_PATHS = ["/pos", "/sell", "/classic", "/schedule", "/scan", "/checkin", "/shift", "/login", "/pair", "/reservations", "/quick-pass", "/profile", "/tills", "/till-settings"];

/**
 * The routes drawn in the Go product theme (`data-product="go"` on <html>):
 * the till's softer radii, lifted cards and touch density. Set on <html> rather
 * than on the shell, because dialogs, menus and toasts are portalled to <body>
 * and would otherwise fall back to the OS shapes. `/classic` is left out on
 * purpose: it is the till as it was before 6 September, with its own kit.
 */
export const GO_PATHS = TILL_PATHS.filter((p) => p !== "/classic" && p !== "/tills");

/** Whether a path is one of `paths` or below one of them. */
export function onPaths(pathname: string, paths: readonly string[]): boolean {
  return paths.some((x) => pathname === x || pathname.startsWith(x + "/"));
}

/** 16px at normal — the browser's own default, and the size everything in the
 *  till was drawn against. */
export const TILL_TEXT_PX: Record<string, number> = { normal: 16, large: 18, largest: 20 };

export const PREFS_BOOT =
  'try{var p=JSON.parse(localStorage.getItem("cf_prefs")||"{}"),d=document.documentElement;' +
  'if(p.reduceMotion)d.dataset.motion="reduce";' +
  'if(p.moreContrast)d.dataset.contrast="more";' +
  "var s=" + JSON.stringify(TILL_TEXT_PX) + "[p.tillText]," +
  "t=" + JSON.stringify(TILL_PATHS) + "," +
  "g=" + JSON.stringify(GO_PATHS) + ";" +
  "function on(a){return a.some(function(x){return location.pathname===x||location.pathname.indexOf(x+\"/\")===0})}" +
  "if(s&&on(t))d.style.fontSize=s+\"px\";" +
  "if(on(g))d.dataset.product=\"go\"" +
  "}catch(e){}";
