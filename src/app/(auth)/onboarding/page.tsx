"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Select } from "@/components/ui";

/* A select under the auth label: same fg 14/500 label as AuthField, same 40px (44 on touch) control. */
function AuthSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: string[] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">{label}</label>
      <Select id={id} value={value} onChange={onChange} options={items.map((c) => ({ value: c, label: c }))} triggerClassName="h-10 max-sm:h-11 [@media(pointer:coarse)]:h-11" />
    </div>
  );
}
import { getOperatorState, isFreshAccount, markFreshAccount, updateOperator } from "@/lib/api";
import { AuthHeading, authButtonClass } from "../_components/AuthHeading";
import { AuthField } from "../_components/AuthField";

const COUNTRIES = ["Bangladesh", "Malaysia", "United States", "Canada"];
const CURRENCIES = ["BDT", "MYR", "USD", "CAD"];
const TIMEZONES = ["Asia/Dhaka", "Asia/Kuala_Lumpur", "America/New_York", "America/Toronto"];

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("auth.onboarding");
  // The business name was typed at sign-up; it is the first thing this page remembers.
  const [name, setName] = useState(() => getOperatorState().name);
  const [country, setCountry] = useState("Bangladesh");
  const [currency, setCurrency] = useState("BDT");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError(t("nameMissing"));
      return;
    }
    setSaving(true);
    await updateOperator({ name: name.trim(), currency, defaultTimezone: timezone });
    if (isFreshAccount()) markFreshAccount(name.trim(), { currency, defaultTimezone: timezone });
    setSaving(false);
    router.push("/dashboard");
  };

  return (
    <div className="w-full">
      <AuthHeading eyebrow={<p className="text-sm font-medium text-brand-foreground">{t("eyebrow")}</p>} title={t("title")} lead={t("lead")} />

      <div className="mt-major flex flex-col gap-section">
        <AuthField
          label={t("name")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          error={error}
        />
        <AuthSelect label={t("country")} value={country} onChange={setCountry} items={COUNTRIES} />
        <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
          <AuthSelect label={t("currency")} value={currency} onChange={setCurrency} items={CURRENCIES} />
          <AuthSelect label={t("timezone")} value={timezone} onChange={setTimezone} items={TIMEZONES} />
        </div>
      </div>

      <Button fullWidth size="md" className={`mt-major ${authButtonClass}`} loading={saving} onClick={submit}>
        {t("submit")}
      </Button>
    </div>
  );
}
