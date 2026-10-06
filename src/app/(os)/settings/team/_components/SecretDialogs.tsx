"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Modal, useToast } from "@/components/ui";
import {
  generatePin,
  passwordIssue,
  pinIssue,
  setStaffPassword,
  setStaffPin,
  type Staff,
} from "@/lib/api";
import { controlCls } from "../../_components/SettingsKit";
import { SecretInput, StrengthMeter, usePasswordMessage, usePinMessage } from "./PasswordFields";

/**
 * "Set a new password" and "Set a till PIN", for someone who already has an
 * account. Both live in a dialog because each is a one-off act on a person,
 * not a setting of the page; both use the same rules, and the same words for
 * refusing them, as the invite form.
 */

export function SetPasswordDialog({
  member,
  open,
  onClose,
  onDone,
}: {
  member: Staff;
  open: boolean;
  onClose: () => void;
  onDone: (s: Staff) => void;
}) {
  const t = useTranslations("settings");
  const toast = useToast();
  const say = usePasswordMessage();
  const ids = { pw: useId(), pw2: useId(), hint: useId(), err: useId(), err2: useId(), must: useId() };
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [must, setMust] = useState(true);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const err = say(pw ? passwordIssue(pw, member) : null) ?? (tried && !pw ? say(passwordIssue("", member)) : undefined);
  const mismatch = pw2 && pw !== pw2 ? t("team.pwMismatch") : tried && !pw2 ? t("team.pwMismatch") : undefined;
  const valid = !!pw && !passwordIssue(pw, member) && pw === pw2;

  const reset = () => {
    setPw("");
    setPw2("");
    setShow(false);
    setMust(true);
    setTried(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    setTried(true);
    if (!valid) return;
    setSaving(true);
    const res = await setStaffPassword(member.id, pw, must);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t(must ? "team.setPwDoneChange" : "team.setPwDone", { name: member.name }));
    reset();
    onDone(res.data);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("team.setPwTitle", { name: member.name })}
      description={t("team.pwSafe")}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t("save.cancel")}
          </Button>
          <Button onClick={save} loading={saving}>
            {t("team.setPwSave")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <div>
          <label htmlFor={ids.pw} className="text-sm font-medium text-fg">
            {t("team.pwLabel")}
          </label>
          <div className="mt-tight">
            <SecretInput
              id={ids.pw}
              value={pw}
              onChange={setPw}
              show={show}
              onToggleShow={() => setShow((s) => !s)}
              invalid={!!err}
              describedBy={`${ids.hint} ${err ? ids.err : ""}`.trim()}
              showLabel={t("team.pwShow")}
              hideLabel={t("team.pwHide")}
            />
          </div>
          <p id={ids.hint} className="mt-inline text-[13px] text-muted">
            {t("team.pwHint")}
          </p>
          {err && (
            <p id={ids.err} className="mt-tight text-[12px] text-danger">
              {err}
            </p>
          )}
          <StrengthMeter password={pw} />
        </div>
        <div>
          <label htmlFor={ids.pw2} className="text-sm font-medium text-fg">
            {t("team.pwConfirmLabel")}
          </label>
          <input
            id={ids.pw2}
            type={show ? "text" : "password"}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            aria-invalid={!!mismatch || undefined}
            aria-describedby={mismatch ? ids.err2 : undefined}
            className={`${controlCls(!!mismatch)} mt-tight`}
          />
          {mismatch && (
            <p id={ids.err2} className="mt-tight text-[12px] text-danger">
              {mismatch}
            </p>
          )}
        </div>
        <label htmlFor={ids.must} className="flex min-h-11 cursor-pointer items-start gap-comfortable text-sm text-fg">
          <input
            id={ids.must}
            type="checkbox"
            checked={must}
            onChange={(e) => setMust(e.target.checked)}
            className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
          />
          <span>{t("team.pwMustChange")}</span>
        </label>
      </div>
    </Modal>
  );
}

export function SetPinDialog({
  member,
  open,
  onClose,
  onDone,
}: {
  member: Staff;
  open: boolean;
  onClose: () => void;
  onDone: (s: Staff) => void;
}) {
  const t = useTranslations("settings");
  const toast = useToast();
  const say = usePinMessage();
  const ids = { pin: useId(), err: useId(), hint: useId() };
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const issue = pin ? pinIssue(pin) : tried ? "length" : null;
  const err = say(issue);

  const close = () => {
    setPin("");
    setShow(false);
    setTried(false);
    onClose();
  };

  const save = async () => {
    setTried(true);
    if (!pin || pinIssue(pin)) return;
    setSaving(true);
    const res = await setStaffPin(member.id, pin);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("team.pinDone", { name: member.name }));
    setPin("");
    setShow(false);
    setTried(false);
    onDone(res.data);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("team.pinTitle", { name: member.name })}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t("save.cancel")}
          </Button>
          <Button onClick={save} loading={saving}>
            {t("team.pinSave")}
          </Button>
        </>
      }
    >
      <label htmlFor={ids.pin} className="text-sm font-medium text-fg">
        {t("team.pinLabel")}
      </label>
      <div className="mt-tight flex flex-col gap-tight sm:flex-row">
        <div className="min-w-0 flex-1">
          <SecretInput
            id={ids.pin}
            value={pin}
            onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
            show={show}
            onToggleShow={() => setShow((s) => !s)}
            invalid={!!err}
            describedBy={`${ids.hint} ${err ? ids.err : ""}`.trim()}
            showLabel={t("team.pinShow")}
            hideLabel={t("team.pinHide")}
            autoComplete="off"
            inputMode="numeric"
            maxLength={6}
            mono
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setPin(generatePin(4));
            setShow(true);
          }}
        >
          {t("team.pinGenerate")}
        </Button>
      </div>
      <p id={ids.hint} className="mt-inline text-[13px] text-muted">
        {t("team.pinHintSet")}
      </p>
      {err && (
        <p id={ids.err} className="mt-tight text-[12px] text-danger">
          {err}
        </p>
      )}
    </Modal>
  );
}
