"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { RANGE_LABELS, RANGE_ORDER, type RangeKey } from "@/lib/dateRange";

export function DateRangeFilter({ activeKey }: { activeKey: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");

  function go(key: RangeKey, extra?: { from?: string; to?: string }) {
    const params = new URLSearchParams();
    params.set("range", key);
    if (extra?.from) params.set("from", extra.from);
    if (extra?.to) params.set("to", extra.to);
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectChip(key: RangeKey) {
    if (key === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    go(key);
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    go("custom", { from, to });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
        {RANGE_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => selectChip(key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              activeKey === key
                ? "bg-indigo-500 text-white shadow-sm shadow-indigo-900/50"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {customOpen && (
        <form
          onSubmit={applyCustom}
          className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-1.5"
        >
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-transparent text-sm text-white outline-none [color-scheme:dark]"
          />
          <span className="text-neutral-500 text-sm">–</span>
          <input
            type="date"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-transparent text-sm text-white outline-none [color-scheme:dark]"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium px-3 py-1 transition"
          >
            Visa
          </button>
        </form>
      )}
    </div>
  );
}
