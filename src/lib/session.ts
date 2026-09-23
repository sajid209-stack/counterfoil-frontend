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

/**
 * The counter this device is paired to.
 *
 * The till was filing every sale at `locations[0]` — which `listLocations`
 * sorts by name, so a device standing at Lalbagh Fort recorded its sales at
 * Ahsan Manzil Museum. Harmless-looking until stock arrived: a sale has to
 * take the item off the shelf it was actually handed over from, and an item
 * kept only at the fort could not be taken off the museum's shelf at all, so
 * the movement was refused and silently dropped.
 *
 * Here rather than in each till for the reason this module exists: three
 * screens were each keeping their own copy of a fact the real session will
 * replace.
 */
export const DEMO_COUNTER_ID = "cnt_fort_main";
