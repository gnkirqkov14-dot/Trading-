"use client";

import { useRouter } from "next/navigation";
import { SettlementSearch } from "@/components/settlement-search";

export function HomeSettlementSearch() {
  const router = useRouter();

  return (
    <SettlementSearch
      className="w-full"
      selected={null}
      placeholder="Търси населено място — напиши първите букви..."
      onSelect={(settlement) => {
        if (settlement) router.push(`/listings?city=${settlement.id}`);
      }}
    />
  );
}
