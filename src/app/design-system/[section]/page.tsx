import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionPage } from "../_components/SectionPage";
import { SECTION_COMPONENTS } from "../_sections";
import { SECTIONS, sectionBySlug } from "../_sections/registry";

/* The overview is the route root, so it is not a [section]. Anything that is
   not in the list is a 404 rather than an on-demand render of nothing. */
export const dynamicParams = false;

export function generateStaticParams() {
  return SECTIONS.filter((s) => s.slug !== "overview").map((s) => ({ section: s.slug }));
}

// `params` is a Promise in this version of Next.
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const meta = sectionBySlug(section);
  return { title: meta?.title ?? "Design System" };
}

export default async function DesignSystemSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const Component = SECTION_COMPONENTS[section];
  if (!Component || section === "overview") notFound();
  return (
    <SectionPage slug={section}>
      <Component />
    </SectionPage>
  );
}
