"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, FlaskConical, Trash2 } from "lucide-react";
import { StatusScreen } from "@/components/screens";
import { ActionMenu, Button, Modal, PageShell, Sheet, StatusPill, Switch, Tabs, tabPanelProps, useToast, type ActionMenuItem, controlClass } from "@/components/ui";
import { SaveBar } from "@/app/(os)/settings/_components/SettingsKit";
import { useApiQuery } from "@/lib/useApi";
import { LG, MD, useMediaQuery } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { copySequence, deleteSequence, getOperator, getSequence, restoreSequence, setSequenceOn, updateSequence, useSequencesVersion } from "@/lib/api";
import {
  MAX_STEPS,
  START_META,
  blankStart,
  countSteps,
  findStep,
  placedSteps,
  sequenceProblems,
  stateOf,
  stepTitle,
  type SeqT,
  type Sequence,
  type SequenceInput,
  type Slot,
  type StartKind,
} from "@/lib/sequences";
import { STATE_TONE } from "../kinds";
import { BuilderProvider, type Selected } from "./context";
import { AddStepDialog } from "./flow/AddStepDialog";
import { Flow, FlowSkeleton } from "./flow/Flow";
import { PanelBody } from "./panel/PanelBody";
import { RunsTab } from "./RunsTab";
import { TryItDialog } from "./TryItDialog";

type TabId = "steps" | "runs";

const asInput = (s: Sequence): SequenceInput => ({ name: s.name, start: s.start, onlyIf: s.onlyIf, steps: s.steps, stopIf: s.stopIf, quietHours: s.quietHours, ideaId: s.ideaId });

export function BuilderView({ id }: { id: string }) {
  const ts = useTranslations("sequences");
  const tb = useTranslations("sequenceBuilder");
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wide = useMediaQuery(MD);
  const lg = useMediaQuery(LG);
  const version = useSequencesVersion();
  const q = useApiQuery(() => getSequence(id), [id, version]);
  const op = useApiQuery(() => getOperator(), []);
  const data = q.data;

  const isNew = params.get("new") === "1";
  const tab: TabId = params.get("tab") === "runs" ? "runs" : "steps";
  const setTab = (next: string) => {
    const qs = new URLSearchParams(params.toString());
    if (next === "runs") qs.set("tab", "runs");
    else qs.delete("tab");
    const s = qs.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const [draft, setDraft] = useState<SequenceInput | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Selected>(null);
  /** A new sequence asks "When should it start?" first, once. */
  const [startPicked, setStartPicked] = useState(false);
  /** Problems are pointed at once the owner has tried to switch it on, not before. */
  const [triedOn, setTriedOn] = useState(false);
  const [addSlot, setAddSlot] = useState<Slot | null>(null);
  const [trying, setTrying] = useState(false);
  const [askOff, setAskOff] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const saved = useMemo(() => (data ? asInput(data) : null), [data]);
  const form = draft ?? saved;
  const problems = useMemo(() => (form ? sequenceProblems(form) : []), [form]);
  const numbers = useMemo(() => {
    const out: Record<string, number> = {};
    let n = 0;
    if (form) for (const p of placedSteps(form.steps)) if (p.step.kind !== "wait" && p.step.kind !== "branch") out[p.step.id] = ++n;
    return out;
  }, [form]);

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved) && JSON.stringify(form) !== lastSaved;
  const sel: Selected = selected === "start" ? "start" : selected && form && findStep(form.steps, selected) ? selected : null;

  const change = useCallback(
    (patch: Partial<SequenceInput>) => {
      if (!saved) return;
      setDraft((prev) => ({ ...(prev ?? saved), ...patch }));
    },
    [saved],
  );

  const choosing = isNew && !startPicked && !!form && form.steps.length === 0;
  const pickStart = (kind: StartKind) => {
    setStartPicked(true);
    if (form) {
      const next = { ...form, start: blankStart(kind) };
      // Shown at once, kept at once: the draft holds it until the save lands.
      setDraft(next);
      setLastSaved(JSON.stringify(next));
      void updateSequence(id, next).then((res) => {
        if (res.ok) q.reload();
        else {
          setLastSaved(null);
          toast.error(res.error.message);
        }
      });
    }
    // Only a start with a setting of its own (how long before, how many days,
    // how much) opens its panel; the rest go straight to "Add the first step".
    const m = START_META[kind];
    setSelected(m.span || m.days || m.amount ? "start" : null);
  };

  const focusName = useCallback(() => {
    setSelected(null);
    nameRef.current?.focus();
  }, []);

  const save = async (): Promise<boolean> => {
    if (!form) return false;
    setSaving(true);
    const res = await updateSequence(id, form);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return false;
    }
    toast.success(tb("saved"));
    setLastSaved(JSON.stringify(form));
    q.reload();
    return true;
  };
  const discard = () => {
    setDraft(null);
    setLastSaved(null);
  };

  const back = { href: "/sequences", label: tb("back") };

  if (!q.loading && (q.error || !data)) {
    return (
      <PageShell title={tb("title.untitled")} back={back}>
        <StatusScreen variant="notFound" framed homeHref="/sequences" homeLabel={tb("back")} title={tb("notFound")} />
      </PageShell>
    );
  }
  if (!data || !form || !saved) {
    return (
      <PageShell title={tb("title.untitled")} back={back}>
        <div className="mx-auto w-full max-w-xl">
          <FlowSkeleton />
        </div>
      </PageShell>
    );
  }

  const state = stateOf({ ...data, ...form } as Sequence);
  const isOn = data.status === "on";
  const title = form.name.trim() || tb("title.untitled");

  const goToProblem = (where: string) => {
    if (where === "name") focusName();
    else setSelected(where === "start" ? "start" : where);
  };

  const turnOn = async () => {
    if (problems.length) {
      setTriedOn(true);
      toast.error(tb("finishFirst", { problem: ts(`problem.${problems[0].code}`) }));
      goToProblem(problems[0].where);
      return;
    }
    if (dirty && !(await save())) return;
    const res = await setSequenceOn(id, true);
    if (res.ok) toast.success(tb("switchedOn"));
    else toast.error(res.error.message);
  };
  const turnOff = async (stopWaiting: boolean) => {
    setAskOff(false);
    const res = await setSequenceOn(id, false, stopWaiting ? { stopWaiting: true } : {});
    if (res.ok) toast.success(tb("switchedOff"));
    else toast.error(res.error.message);
  };
  const onSwitch = (next: boolean) => {
    if (next) void turnOn();
    else if (data.working > 0) setAskOff(true);
    else void turnOff(false);
  };

  const copy = async () => {
    const res = await copySequence(id, tb("copyName", { name: data.name || tb("title.untitled") }));
    if (res.ok) {
      toast.success(tb("copied"));
      router.push(`/sequences/${res.data.id}`);
    } else toast.error(res.error.message);
  };
  const remove = async () => {
    const res = await deleteSequence(id);
    if (!res.ok) return toast.error(res.error.message);
    discard();
    toast.success(tb("deleted", { name: title }), { run: () => void restoreSequence(id) });
    router.push("/sequences");
  };

  const menu: ActionMenuItem[] = [
    { key: "copy", label: tb("copy"), icon: <Copy size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => void copy() },
    { key: "delete", label: tb("delete"), icon: <Trash2 size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => void remove(), destructive: true, separated: true },
  ];
  const tryBtn = (
    <Button variant="secondary" icon={<FlaskConical size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setTrying(true)}>
      {tb("tryIt")}
    </Button>
  );
  const onOff = <Switch checked={isOn} onChange={onSwitch} label={isOn ? tb("on") : tb("off")} />;

  const actions = wide ? (
    <div className="flex flex-wrap items-center gap-comfortable">
      {tryBtn}
      {onOff}
      <ActionMenu label={tb("menu", { name: title })} items={menu} />
    </div>
  ) : (
    <div role="group" aria-label={tb("menu", { name: title })} className="flex min-w-48 flex-col items-stretch gap-inline">
      {menu.map((it) => (
        <Button key={it.key} variant={it.destructive ? "destructive" : "tertiary"} icon={it.icon} onClick={it.onSelect} className="justify-start">
          {it.label}
        </Button>
      ))}
    </div>
  );

  const ctx = {
    form,
    problems,
    selected: sel,
    select: setSelected,
    change,
    addAt: setAddSlot,
    canAdd: countSteps(form.steps) < MAX_STEPS,
    numbers,
    ts: ts as unknown as SeqT,
    tb: tb as unknown as SeqT,
    venue: op.data?.name ?? "",
    isNew,
    choosing,
    pickStart,
    focusName,
  };

  const selTitle = sel === "start" ? ts("start.label") : sel ? stepTitle(ts as unknown as SeqT, findStep(form.steps, sel)!.step) : "";
  // An empty name is not an error while the owner is still building: it turns
  // red when they try to switch the sequence on (the summary lists it meanwhile).
  const nameProblem = !form.name.trim() && (triedOn || !isNew);

  return (
    <BuilderProvider value={ctx}>
      <PageShell title={title} back={back} status={<StatusPill tone={STATE_TONE[state]}>{ts(`state.${state}`)}</StatusPill>} actions={actions}>
        <div className="flex flex-col gap-section">
          <Tabs
            id="seq"
            aria-label={tb("tabs.label")}
            items={[
              { value: "steps", label: tb("tabs.steps") },
              { value: "runs", label: tb("tabs.runs") },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div {...tabPanelProps("seq", tab)} className="flex min-w-0 flex-col gap-section outline-none">
            {tab === "steps" ? (
              <div className={cn("grid gap-section lg:items-start", !choosing && "lg:grid-cols-[minmax(0,1fr)_22.5rem]")}>
                <div className="mx-auto flex w-full max-w-2xl flex-col gap-section">
                  {/* On a phone the two things an owner does most — switch it on, try it —
                      are on the page, not behind "more" with Copy and Delete. */}
                  {!wide && !choosing && form.steps.length > 0 && (
                    <div className="card-surface flex items-center justify-between gap-comfortable p-comfortable">
                      {onOff}
                      {tryBtn}
                    </div>
                  )}
                  <div className="flex flex-col gap-inline">
                    <label htmlFor="seq-name" className="text-xs font-medium text-muted">
                      {tb("name.label")}
                    </label>
                    <div>
                      <input
                        id="seq-name"
                        ref={nameRef}
                        value={form.name}
                        maxLength={80}
                        placeholder={tb("name.placeholder")}
                        aria-invalid={nameProblem || undefined}
                        onChange={(e) => change({ name: e.target.value })}
                        className={cn(controlClass(nameProblem), "bg-card font-medium")}
                      />
                    </div>
                    {nameProblem && <p className="text-sm text-danger">{ts("problem.name")}</p>}
                  </div>
                  <Flow />
                </div>
                {lg && !choosing && (
                  <aside
                    aria-label={tb("panel.label")}
                    onKeyDown={(e) => e.key === "Escape" && setSelected(null)}
                    className={cn("card-surface sticky top-section max-h-screen overflow-y-auto")}
                  >
                    <PanelBody />
                  </aside>
                )}
              </div>
            ) : (
              <RunsTab id={id} runs30={data.runs30} working={data.working} problems={data.problems} />
            )}
          </div>
          <SaveBar dirty={dirty} saving={saving} invalid={false} onSave={() => void save()} onDiscard={discard} />
        </div>

        <AddStepDialog slot={addSlot} onClose={() => setAddSlot(null)} />
        {!lg && tab === "steps" && (
          <Sheet open={!!sel} onClose={() => setSelected(null)} title={selTitle} closeLabel={tb("close")}>
            <PanelBody inSheet />
          </Sheet>
        )}
        {trying && <TryItDialog onClose={() => setTrying(false)} />}
        <Modal
          open={askOff}
          onClose={() => setAskOff(false)}
          size="sm"
          title={tb("askOff.title", { count: data.working })}
          footer={
            <div className="flex w-full flex-wrap justify-end gap-tight">
              <Button variant="secondary" onClick={() => void turnOff(false)}>
                {tb("askOff.finish")}
              </Button>
              <Button variant="destructive" onClick={() => void turnOff(true)}>
                {tb("askOff.stop")}
              </Button>
            </div>
          }
        />
      </PageShell>
    </BuilderProvider>
  );
}

