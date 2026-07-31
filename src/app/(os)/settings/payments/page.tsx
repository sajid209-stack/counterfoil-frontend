"use client";

import { useState } from "react";
import { Button, FormField, PageShell, useToast } from "@/components/ui";

const METHODS = [
  { key: "cash", label: "Cash", helper: "Notes and coins at the counter." },
  { key: "card_terminal", label: "Card terminal", helper: "Chip and tap card machine." },
  { key: "bkash", label: "bKash", helper: "Mobile wallet." },
  { key: "bangla_qr", label: "Bangla QR", helper: "Interoperable QR payments." },
  { key: "voucher", label: "Voucher", helper: "Prepaid or comp vouchers." },
  { key: "credit", label: "Credit", helper: "On-account for trusted partners." },
];

export default function PaymentsSettingsPage() {
  const toast = useToast();
  const [on, setOn] = useState<Record<string, boolean>>({ cash: true, card_terminal: true, bkash: true, bangla_qr: true, voucher: false, credit: false });

  return (
    <PageShell title="Payments" description="Which payment methods your counters can take." actions={<Button onClick={() => toast.success("Payment methods saved.")}>Save changes</Button>}>
      <div className="max-w-xl overflow-hidden rounded-md border border-line bg-card">
        {METHODS.map((m) => (
          <div key={m.key} className="flex items-center justify-between border-b border-line p-section last:border-0">
            <div>
              <div className="text-sm font-medium">{m.label}</div>
              <div className="text-[12px] text-faint">{m.helper}</div>
            </div>
            <FormField variant="toggle" checked={on[m.key]} onChange={(e) => setOn((s) => ({ ...s, [m.key]: (e.target as HTMLInputElement).checked }))} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
