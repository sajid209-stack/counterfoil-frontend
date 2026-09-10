import { PageShell } from "@/components/ui";
import { getTranslations } from "next-intl/server";
import { EventWizard } from "./_components/EventWizard";

export default async function NewEventPage() {
  const t = await getTranslations("events");
  return (
    <PageShell title={t("newTitle")} description={t("newDescription")}>
      <EventWizard />
    </PageShell>
  );
}
