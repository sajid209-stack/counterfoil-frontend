"use client";

import { use } from "react";
import { BuilderView } from "../_components/builder/BuilderView";

export default function SequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BuilderView key={id} id={id} />;
}
