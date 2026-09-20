"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Camera, Check, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  addOrderPayment,
  admitTicket,
  canTakeNonCash,
  getOperator,
  listTickets,
  peekOrders,
  redeemTicket,
  tillMethods,
  type PaymentMethod,
} from "@/lib/api";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import { resolveScan, type ScanOutcome } from "./_lib/outcome";
import { CameraScanner, useCameraSupport } from "./_components/CameraScanner";
import { Verdict } from "./_components/Verdict";

/* A hardware scanner is a keyboard: it types the code fast and presses Enter.
   Everything at a gate follows from that — the field is focused on arrival and
   refocused after every verdict, and a window-level listener catches a burst
   that arrives while focus is somewhere else, which is the one failure mode
   every keyboard-wedge guide warns about. */
const BURST_GAP_MS = 120;
const BURST_MIN = 6;

interface LogEntry {
  id: number;
  code: string;
  title: string;
  verdict: ScanOutcome["verdict"];
  at: Date;
}

export default function ScanPage() {
  const t = useTranslations("scan");
  const format = useFormatter();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [logId, setLogId] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  /* A counter, not state: the id is needed BEFORE the render that uses it,
     and minting it inside a state updater got the entry written twice, since
     React invokes an updater more than once on purpose. */
  const seq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [admitted, setAdmitted] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [camOpen, setCamOpen] = useState(false);

  const opQ = useApiQuery(() => getOperator(), []);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 2000 }), []);
  const currency = opQ.data?.currency ?? "BDT";
  const cameraReady = useCameraSupport();
  const methods = useMemo(() => tillMethods(canTakeNonCash()), []);

  const submit = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || busy) return;
      setBusy(true);
      const result = await resolveScan(value);
      /* Redeemed only once the gate has decided to admit, and only for a
         ticket that admits one — a group is spent person by person on the
         verdict itself. */
      if (result.verdict === "admit" && result.ticketId) await redeemTicket(result.ticketId);
      setBusy(false);
      setOutcome(result);
      setAdmitted(result.group?.admitted ?? 0);
      setCode("");
      const id = (seq.current += 1);
      setLogId(id);
      setLog((prev) => [{ id, code: result.code, title: result.title, verdict: result.verdict, at: new Date() }, ...prev].slice(0, 8));
    },
    [busy],
  );

  const close = useCallback(() => {
    setOutcome(null);
    input.current?.focus();
  }, []);

  /* The safety net: a burst of keystrokes ending in Enter, arriving while the
     field does NOT have focus, is a scanner — a person typing cannot hold a
     120ms cadence for six characters. Keystrokes inside the field are left to
     the field, so nothing is submitted twice. */
  const decisionOpen = outcome?.verdict === "group" || outcome?.verdict === "balance";
  useEffect(() => {
    /* Left armed while a plain verdict is up, so a steward can keep scanning
       without touching the screen — the next scan replaces the last one. A
       verdict that is waiting on a decision does hold the gate. */
    if (decisionOpen || camOpen) return;
    let buffer = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const now = Date.now();
      if (now - last > BURST_GAP_MS) buffer = "";
      last = now;
      if (e.key === "Enter") {
        const captured = buffer;
        buffer = "";
        if (captured.length >= BURST_MIN) {
          e.preventDefault();
          void submit(captured);
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decisionOpen, camOpen, submit]);

  const settle = async () => {
    if (!outcome?.balance || busy) return;
    setBusy(true);
    const res = await addOrderPayment(outcome.balance.orderId, method, outcome.balance.amount, "Gate");
    if (!res.ok) {
      setBusy(false);
      return;
    }
    if (!outcome.group) await redeemTicket(outcome.balance.ticketId);
    setBusy(false);
    const next: ScanOutcome = { ...outcome, verdict: outcome.group ? "group" : "admit", balance: undefined };
    setOutcome(next);
    setLog((prev) => prev.map((e) => (e.id === logId ? { ...e, verdict: next.verdict } : e)));
  };

  const admit = async (count: number) => {
    if (!outcome?.group || busy) return;
    setBusy(true);
    const res = await admitTicket(outcome.group.ticketId, count);
    setBusy(false);
    if (res.ok) setAdmitted(res.data.admitted ?? 0);
  };

  const tally = useMemo(() => {
    const out = { admit: 0, refuse: 0, balance: 0 };
    for (const e of log) {
      if (e.verdict === "refuse") out.refuse += 1;
      else if (e.verdict === "balance") out.balance += 1;
      else out.admit += 1;
    }
    return out;
  }, [log]);

  /* Three codes that between them produce the three answers a gate gives, so
     the demo can be walked without hunting for one. Read from the seed rather
     than hard-coded: the four chips this replaces were simply the first four
     tickets, three of which happened to be void or already used. */
  const demo = useMemo(() => {
    const tickets = ticketsQ.data?.data ?? [];
    const orders = peekOrders();
    const due = (orderId: string) => {
      const o = orders.find((x) => x.id === orderId);
      return o ? Math.max(0, o.total - o.payments.reduce((s, p) => s + p.amount, 0)) : 0;
    };
    const valid = tickets.find((x) => x.status === "issued" && due(x.orderId) === 0 && (x.admits ?? 1) === 1);
    const used = tickets.find((x) => x.status === "redeemed");
    const owing = tickets.find((x) => x.status === "issued" && due(x.orderId) > 0);
    return [
      valid && { key: "valid", label: t("demoValid"), code: valid.code },
      used && { key: "used", label: t("demoUsed"), code: used.code },
      owing && { key: "owing", label: t("demoOwing"), code: owing.code },
    ].filter(Boolean) as { key: string; label: string; code: string }[];
  }, [ticketsQ.data, t]);

  const verdictLabels = outcome && {
    admit: t("admit"),
    admitCount: (count: number) => t("admitCount", { count }),
    doNotAdmit: t("doNotAdmit"),
    balanceDue: t("balanceDue"),
    reason: outcome.reason ? t(outcome.reason) : outcome.title,
    advice: outcome.reason ? t(`advice_${outcome.reason}`) : "",
    usedAt: outcome.usedAt ? t("usedAt", { when: formatDateTime(outcome.usedAt) }) : undefined,
    dated: outcome.dated ? t("datedFor", { date: formatDay(outcome.dated) }) : undefined,
    code: outcome.code,
    dismiss: outcome.verdict === "group" || outcome.verdict === "balance" ? t("scanNext") : t("readyNext"),
    plusOne: t("plusOne"),
    admitAll: (count: number) => t("admitAll", { count }),
    everyoneIn: t("everyoneIn"),
    groupSummary: outcome.group ? t("groupSummary", { reason: outcome.title, size: outcome.group.admits, admitted }) : "",
    takeAndAdmit: outcome.balance ? t("takeAndAdmit", { amount: formatMoney(outcome.balance.amount, currency) }) : "",
    amount: outcome.balance ? formatMoney(outcome.balance.amount, currency) : "",
    methodLabel: (m: PaymentMethod) => t(`method_${m}`),
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-section py-section lg:min-h-[calc(100dvh-64px)] lg:justify-center">
      <div className="flex w-full flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-section">
          <div>
            <h1 className="type-h1 text-xl">{t("title")}</h1>
            <p className="text-[13px] text-muted">{t("subtitle")}</p>
          </div>

          {/* One object: the state of the gate, the field a scanner types
              into, and the two ways to send a code. */}
          <section className="flex flex-col gap-comfortable rounded-go p-section go-surface">
            <p className="flex items-center gap-tight">
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", busy ? "bg-muted" : "bg-ember-solid")} />
              <span className="text-[13px] font-semibold text-brand-foreground">{busy ? t("checking") : t("armed")}</span>
            </p>
            <span data-focus-host className="block">
              <input
              ref={input}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit(code);
              }}
              aria-label={t("codeLabel")}
              placeholder={t("codePlaceholder")}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              className="h-16 w-full min-w-0 rounded-go border-2 border-line bg-card px-section font-mono text-lg tracking-[0.02em] outline-none transition-colors duration-quick focus:border-ember-solid lg:h-20 lg:text-xl"
              />
            </span>
            <div className="flex gap-tight">
              <Button size="lg" shape="pill" fullWidth disabled={!code.trim() || busy} onClick={() => void submit(code)}>
                {t("check")}
              </Button>
              {cameraReady && (
                <Button size="lg" shape="pill" variant="secondary" className="shrink-0" onClick={() => setCamOpen(true)}>
                  <Camera size={18} strokeWidth={1.5} aria-hidden />
                  {t("camera")}
                </Button>
              )}
            </div>
            <p className="text-[13px] text-muted">{t("armedHint")}</p>
          </section>

          {demo.length > 0 && (
            <section className="flex flex-col gap-tight">
              <h2 className="text-[13px] font-semibold text-muted">{t("demoTitle")}</h2>
              <div className="flex flex-wrap gap-tight">
                {demo.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => void submit(d.code)}
                    className="flex min-h-11 flex-col items-start justify-center rounded-go-sm border border-line bg-card px-comfortable py-inline text-left active:bg-ember/10"
                  >
                    <span className="text-[13px] font-semibold">{d.label}</span>
                    <span className="font-mono text-[13px] text-muted">{d.code}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* What this device has done since the screen was opened. A gate with
            no record of its own scans cannot answer the one question a guest
            asks when they are refused. */}
        <aside className="flex flex-col gap-section">
          <section className="flex flex-col gap-comfortable rounded-go p-section go-surface">
            <h2 className="text-sm font-semibold">{t("sessionTitle")}</h2>
            {log.length > 0 && (
            <div className="grid grid-cols-3 gap-tight text-center">
              {(
                [
                  ["admit", tally.admit, Check],
                  ["refuse", tally.refuse, X],
                  ["balance", tally.balance, Wallet],
                ] as const
              ).map(([key, value, Icon]) => (
                <div key={key} className="flex flex-col items-center gap-inline rounded-go-sm border border-hairline py-comfortable">
                  <Icon size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
                  <span className="text-xl font-semibold tabular-nums">{value}</span>
                  <span className="text-[13px] text-muted">{t(`tally_${key}`)}</span>
                </div>
              ))}
            </div>
            )}

            {log.length > 0 && <h3 className="text-[13px] font-semibold text-muted">{t("recentTitle")}</h3>}
            {log.length === 0 ? (
              <p className="text-[13px] text-muted">{t("noScansYet")}</p>
            ) : (
              <ul className="flex flex-col">
                {log.map((e, i) => (
                  <li key={e.id} className={cn("flex items-center gap-tight py-tight", i > 0 && "border-t border-hairline")}>
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        e.verdict === "refuse" ? "bg-danger-solid text-white" : e.verdict === "balance" ? "bg-warning-wash text-fg" : "bg-inverse text-inverse-fg",
                      )}
                    >
                      {e.verdict === "refuse" ? <X size={13} strokeWidth={3} /> : e.verdict === "balance" ? <Wallet size={12} strokeWidth={2} /> : <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px]">{e.code}</span>
                      <span className="block truncate text-[13px] text-muted">{e.title || t(`tally_${e.verdict === "refuse" ? "refuse" : e.verdict === "balance" ? "balance" : "admit"}`)}</span>
                    </span>
                    <span className="shrink-0 text-[13px] text-muted">{format.dateTime(e.at, { hour: "numeric", minute: "numeric" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {camOpen && (
        <CameraScanner
          onClose={() => setCamOpen(false)}
          onCode={(value) => {
            setCamOpen(false);
            void submit(value);
          }}
          labels={{
            title: t("cameraTitle"),
            aim: t("cameraAim"),
            close: t("cameraClose"),
            torch: t("cameraTorch"),
            denied: t("cameraDenied"),
            deniedHint: t("cameraDeniedHint"),
            retry: t("cameraRetry"),
          }}
        />
      )}

      {outcome && verdictLabels && (
        <Verdict
          outcome={outcome}
          labels={verdictLabels}
          admitted={admitted}
          busy={busy}
          methods={methods}
          method={method}
          onMethod={setMethod}
          onAdmit={admit}
          onSettle={settle}
          onClose={close}
        />
      )}
    </main>
  );
}
