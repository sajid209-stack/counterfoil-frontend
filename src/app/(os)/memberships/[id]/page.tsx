"use client";

import { use } from "react";
import { MembershipDetail } from "../_components/detail/MembershipDetail";

export default function MembershipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MembershipDetail id={id} />;
}
