/**
 * Who is signed in to OS, for the demo.
 *
 * There is no authentication yet; the Security page already speaks as Nadia
 * (it shows her e-mail). Anything that has to refuse to act on "yourself" —
 * suspending your own account, taking Settings away from your own role — reads
 * the person from here, rather than each screen keeping its own copy of a name
 * that the real session will replace.
 */
export const DEMO_STAFF_ID = "stf_nadia";
