"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveCounterNow } from "@/lib/activeCounter";
import { resolveThisDevice, useThisDeviceId } from "@/lib/thisDevice";
import { formatClock } from "@/lib/format";
import {
  DEMO_PIN,
  checkStaffPin,
  deviceAccess,
  getAccessPolicy,
  listDevices,
  listStaff,
  peekCounters,
  peopleAllowedOn,
  recordActivity,
  staffPinLength,
  whoCanSignIn,
  whoCanSignInOn,
  type Staff,
} from "@/lib/api";
import { Keypad } from "../_components/Keypad";

// Mock session facts: Nadia's shift has been open since 09:14. Until somebody
// has a PIN of their own, the demo PIN for everyone is 1234.
const BUSINESS = "Lalbagh Heritage Attractions";
const OPEN_SHIFT = { staffId: "stf_nadia", since: "09:14" };

/** Each person's face has a colour of its own, so somebody who cannot read the
 *  names finds themselves by colour. Handed out in the order people joined
 *  this counter, so the first five never share one and a new hire takes the
 *  next colour without repainting anybody else. The five are the validated
 *  accent palette; the letters sit on a light wash of it in ink, so they read
 *  in both themes. */
const FACE_COLORS = ["orange", "blue", "green", "rose", "amber"] as const;
type FaceColor = (typeof FACE_COLORS)[number];
function faceColors(team: Staff[]): Map<string, FaceColor> {
  const ordered = [...team].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(ordered.map((s, i) => [s.id, FACE_COLORS[i % FACE_COLORS.length]]));
}
function Face({ color, name, size }: { color: FaceColor; name: string; size: "lg" | "md" }) {
  const c = color;
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full border-2 font-semibold text-fg ${size === "lg" ? "h-12 w-12 text-[1rem]" : "h-10 w-10 text-[0.9375rem]"}`}
      style={{
        borderColor: `var(--color-cat-${c})`,
        background: `color-mix(in srgb, var(--color-cat-${c}) 22%, var(--color-card))`,
      }}
    >
      {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
    </span>
  );
}

export default function GoLoginPage() {
  const router = useRouter();
  const t = useTranslations("pos");
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  // How many wrong PINs before the pause is the business's call, made in
  // Settings → Sign-in rules; three until that answer arrives.
  const policyQ = useApiQuery(() => getAccessPolicy(), []);
  const maxAttempts = policyQ.data?.pinAttempts ?? 3;

  const [picked, setPicked] = useState<Staff | { id: "guest"; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [takeOver, setTakeOver] = useState(false);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  /* The people who can sign in on THIS tablet: the device paired to the counter
     this till is set to (Go header) decides, and an open tablet means everyone
     who works that counter, as it always did. Nothing is listed until both the
     people and the devices are known, so a limited tablet never flashes the
     whole venue before it narrows. */
  const activeCounter = useActiveCounterNow();
  const ready = !!staffQ.data && !!devicesQ.data;
  /* A tablet that has been PAIRED (Pair this tablet, on /login/pair) knows which
     device it is, and the people listed are the ones allowed on THAT device and
     able to sign in — a person without a till PIN cannot, so they are not
     listed. A tablet that has not been paired keeps the old behaviour: the
     device on the counter this till is set to decides. */
  const thisId = useThisDeviceId();
  const pairedDevice = ready ? resolveThisDevice(devicesQ.data!.data, thisId) : undefined;
  const signIn = ready ? whoCanSignIn(devicesQ.data!.data, staffQ.data!.data, activeCounter.id) : null;
  const device = pairedDevice ?? signIn?.device;
  const pairedOff = pairedDevice?.status === "inactive";
  const team = pairedDevice ? (pairedOff ? [] : whoCanSignInOn(pairedDevice, staffQ.data!.data)) : (signIn?.people ?? []);
  const withoutPin = pairedDevice ? peopleAllowedOn(pairedDevice, staffQ.data!.data).length - team.length : 0;
  const limited = pairedDevice ? deviceAccess(pairedDevice) === "assigned" : !!signIn?.limited;
  const cells = team.length + (limited ? 0 : 1);
  const owner = device?.ownerStaffId ? team.find((s) => s.id === device.ownerStaffId) : undefined;
  const counterName = pairedDevice
    ? peekCounters().find((c) => c.id === pairedDevice.counterId)?.name
    : activeCounter.counter?.name;
  // Somebody's own device goes straight to their PIN pad.
  const who = picked ?? owner ?? null;
  const setWho = (next: typeof picked) => setPicked(next);
  const deviceName = device?.name ?? "";
  // The starting PIN still opens anyone who has not chosen their own.
  const usesDemoPin = !who || who.id === "guest" || checkStaffPin(who.id, DEMO_PIN);
  const colors = faceColors(team);
  const colorOf = (id: string): FaceColor => colors.get(id) ?? "orange";
  const shiftOwner = staffQ.data?.data.find((s) => s.id === OPEN_SHIFT.staffId);

  const proceed = (person: NonNullable<typeof who>) => {
    if (OPEN_SHIFT.staffId && person.id !== OPEN_SHIFT.staffId) setTakeOver(true);
    else router.push(person.id === OPEN_SHIFT.staffId ? "/pos" : "/shift/open");
  };

  // A PIN is 4 to 6 digits; somebody who has not set one uses the demo PIN, 4 long.
  const pinLen = who && who.id !== "guest" ? staffPinLength(who.id) : 4;

  const onKey = (d: string) => {
    if (locked || !who) return;
    const next = (pin + d).slice(0, pinLen);
    setPin(next);
    if (next.length === pinLen) {
      /* The activity log: who tried which till, and whether it opened. A guest
         has no staff record, so only people are logged. */
      const logAs = who.id === "guest" ? null : { staffId: who.id, name: who.name };
      const logAt = { counterId: activeCounter.id, deviceId: device?.id ?? null };
      if (who.id === "guest" ? next === DEMO_PIN : checkStaffPin(who.id, next)) {
        if (logAs) recordActivity({ kind: "staff.signed_in", actor: logAs, ...logAt });
        setAttempts(0);
        setTimeout(() => proceed(who), 150);
      } else {
        // Wrong PIN: shake once, clear, count down — the selection is kept.
        const n = attempts + 1;
        setAttempts(n);
        setShake(true);
        setTimeout(() => { setShake(false); setPin(""); }, 200);
        if (logAs) recordActivity({ kind: "staff.wrong_pin", actor: logAs, ...logAt, data: { attempt: n, max: maxAttempts } });
        if (n >= maxAttempts) {
          if (logAs) recordActivity({ kind: "staff.locked_out", actor: logAs, ...logAt, data: { max: maxAttempts } });
          setLocked(true);
        }
      }
    }
  };

  const stateLine = (s: Staff) =>
    s.id === OPEN_SHIFT.staffId ? t("login.onShiftSince", { time: formatClock(OPEN_SHIFT.since) }) : t("login.offShift");

  return (
    /* Full-bleed and quiet — this screen is a moment, not a form. It used to
       be hardcoded ink, which was fine while the app had one appearance and
       wrong the moment it had two: a dark sign-in sat inside light chrome and
       read as a rendering fault. Semantic tokens now, like everything except
       the two surfaces that are mode-locked on purpose (a scan verdict and the
       ticket stub). */
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center bg-surface px-section py-major text-fg">
      <h1 className="sr-only">{t("signInTitle")}</h1>
      {/* Context bar — confirm you're at the right counter before signing in. */}
      <div className="w-full max-w-lg text-center">
        <p className="text-[0.875rem] font-medium text-muted">
          {[BUSINESS, counterName, deviceName].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-inline text-[0.8125rem] text-muted">
          {shiftOwner ? t("login.shiftOpenBy", { name: shiftOwner.name.split(" ")[0], time: formatClock(OPEN_SHIFT.since) }) : t("login.noShift")}
          {usesDemoPin && <span className="ml-tight text-muted">· {t("login.demoPin", { pin: DEMO_PIN })}</span>}
        </p>
        {/* A limited tablet says so, quietly, and where to change it. Somebody
            who is not on the list should learn why from the screen rather than
            from a colleague. */}
        {limited && (
          <p className="mt-tight text-[0.8125rem] text-muted" data-testid="login-limited">
            {owner ? t("login.ownDevice", { name: owner.name.split(" ")[0] }) : t("login.limitedNote")} {t("login.limitedHow")}
          </p>
        )}
      </div>


      {!ready ? (
        <div aria-busy="true" className="go-surface mt-major h-64 w-full max-w-lg animate-pulse rounded-go" />
      ) : !who && (pairedDevice || limited) && team.length === 0 ? (
        <div className="mt-major max-w-lg text-center" data-testid="login-empty">
          {pairedOff ? (
            <>
              <p className="text-[1rem] font-semibold text-fg">{t("login.deviceOff", { device: deviceName })}</p>
              <p className="mt-tight text-[0.8125rem] text-muted">{t("login.deviceOffHow")}</p>
            </>
          ) : pairedDevice && withoutPin > 0 ? (
            <>
              <p className="text-[1rem] font-semibold text-fg">{t("login.emptyNoPinTitle", { device: deviceName })}</p>
              <p className="mt-tight text-[0.8125rem] text-muted">{t("login.emptyNoPinHow")}</p>
            </>
          ) : pairedDevice ? (
            <>
              <p className="text-[1rem] font-semibold text-fg">{t("login.emptyDeviceTitle", { device: deviceName })}</p>
              <p className="mt-tight text-[0.8125rem] text-muted">{t("login.emptyDeviceHow")}</p>
            </>
          ) : (
            <>
              <p className="text-[1rem] font-semibold text-fg">{t("login.emptyTitle")}</p>
              <p className="mt-tight text-[0.8125rem] text-muted">{t("login.emptyHow")}</p>
            </>
          )}
        </div>
      ) : !who ? (
        <>
          {/* Step 1 — who are you. Faster than a PIN that must also identify. */}
          <p className="mt-major text-[1rem] font-semibold text-fg">{t("login.whoTitle")}</p>
          {/* The people as cells on ONE card — the till's own drawing — each a
              face, a name and whether they are on shift. Tap yours. */}
          {/* As many columns as there are people, up to the grid: a tablet limited to
              one person must not draw them beside an empty half-card. */}
          <div className={`go-surface mt-section w-full overflow-hidden rounded-go ${cells === 1 ? "max-w-xs" : cells === 2 ? "max-w-sm" : "max-w-lg"}`}>
          <div className={`-mb-px -mr-px grid ${cells === 1 ? "grid-cols-1" : cells === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
            {team.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setWho(s); setPin(""); setAttempts(0); setLocked(false); }}
                data-focus-inset
                className="flex min-h-32 flex-col items-center justify-center gap-tight border-b border-r border-line bg-card p-comfortable transition-colors duration-quick active:bg-ember/10"
              >
                <Face color={colorOf(s.id)} name={s.name} size="lg" />
                <span className="max-w-full truncate text-[0.9375rem] font-semibold text-fg">{s.name}</span>
                <span className={`text-[0.8125rem] ${s.id === OPEN_SHIFT.staffId ? "font-medium text-success" : "text-muted"}`}>{stateLine(s)}</span>
              </button>
            ))}
            {/* A door for somebody not on this counter. Closed on a limited
                tablet: signing in as someone who is not allowed must not be
                possible from the screen. */}
            {!limited && (
              <button
                type="button"
                onClick={() => setSomeoneElse(true)}
                data-focus-inset
                className="flex min-h-32 flex-col items-center justify-center gap-tight border-b border-r border-line bg-card p-comfortable text-muted active:bg-ember/10"
              >
                <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-strong text-2xl leading-none">+</span>
                <span className="text-[0.9375rem] font-medium">{t("login.someoneElse")}</span>
              </button>
            )}
          </div>
          </div>
        </>
      ) : (
        <>
          {/* Step 2 — the PIN pad. */}
          <div className="mt-major flex items-center gap-tight">
            <Face color={colorOf(who.id)} name={who.name} size="md" />
            <span className="text-lg">{who.name}</span>
            {!owner && (
              <button type="button" onClick={() => { setWho(null); setPin(""); setAttempts(0); setLocked(false); }} className="ml-tight text-[0.8125rem] text-muted underline-offset-4 active:underline">
                {t("login.notYou")}
              </button>
            )}
          </div>

          <div className={`mt-section flex gap-comfortable ${shake ? "animate-[shake_0.12s_ease-in-out_0s_2]" : ""}`} role="img" aria-label={t("login.pinProgress", { count: pin.length, total: pinLen })}>
            {Array.from({ length: pinLen }, (_, i) => i).map((i) => (
              <span key={i} className={`h-4 w-4 rounded-full border-2 border-fg ${i < pin.length ? "bg-fg" : "bg-transparent"}`} />
            ))}
          </div>

          {locked ? (
            <div className="mt-section flex flex-col items-center gap-tight text-center">
              <p className="text-sm text-danger">{t("login.locked")}</p>
              <Button shape="pill" variant="secondary" onClick={() => { setLocked(false); setAttempts(0); setPin(""); }}>{t("login.managerUnlock")}</Button>
            </div>
          ) : (
            attempts > 0 && (
              <p className="mt-tight text-[0.8125rem] text-danger">
                {t("login.wrongPin", { left: maxAttempts - attempts })}
              </p>
            )
          )}

          <div className="mt-section w-full max-w-xs">
            <Keypad large onKey={onKey} onBackspace={() => setPin((p) => p.slice(0, -1))} />
          </div>
        </>
      )}

      {/* A tablet nobody has paired yet says how, quietly. */}
      {ready && !pairedDevice && !who && (
        <Link
          href="/login/pair"
          data-testid="login-pair-link"
          className="mt-major inline-flex min-h-11 items-center px-section text-[0.875rem] font-medium text-muted underline underline-offset-4 active:text-fg"
        >
          {t("login.pairLink")}
        </Link>
      )}

      {/* Take over an open shift — the drawer stays attributed until now. */}
      <Modal
        open={takeOver}
        onClose={() => setTakeOver(false)}
        title={t("login.takeOverTitle", { name: shiftOwner?.name.split(" ")[0] ?? t("login.takeOverFallback") })}
        footer={<><Button shape="pill" variant="secondary" onClick={() => { setTakeOver(false); setPin(""); }}>{t("login.cancel")}</Button><Button shape="pill" onClick={() => router.push("/pos")}>{t("login.takeOver")}</Button></>}
      >
        <p className="text-sm text-muted">
          {t("login.takeOverBody", { from: shiftOwner?.name ?? t("login.takeOverFallback"), to: who?.name ?? "" })}
        </p>
      </Modal>

      {/* Someone else — staff not assigned to this counter. */}
      <Modal
        open={someoneElse}
        onClose={() => setSomeoneElse(false)}
        title={t("login.someoneElseTitle")}
        footer={<><Button shape="pill" variant="secondary" onClick={() => setSomeoneElse(false)}>{t("login.cancel")}</Button><Button shape="pill" disabled={!guestName.trim()} onClick={() => { setWho({ id: "guest", name: guestName.trim() }); setSomeoneElse(false); setPin(""); setAttempts(0); setLocked(false); }}>{t("login.continue")}</Button></>}
      >
        <div className="flex flex-col gap-section">
          <FormField label={t("login.name")} placeholder={t("login.namePlaceholder")} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <FormField label={t("login.email")} placeholder="name@business.example" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} help={t("login.emailHelp")} />
        </div>
      </Modal>
    </main>
  );
}
