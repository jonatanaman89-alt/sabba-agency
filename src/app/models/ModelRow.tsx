"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Model = {
  id: string;
  name: string;
  alias: string | null;
  status: string;
  revenue_split_percent: number;
};

export function ModelRow({
  model,
  canEdit,
}: {
  model: Model;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function toggleStatus() {
    const next = model.status === "active" ? "paused" : "active";
    await supabase.from("models").update({ status: next }).eq("id", model.id);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div>
        <p className="text-white text-sm font-medium">
          {model.name}
          {model.alias && (
            <span className="text-neutral-500 font-normal">
              {" "}
              ({model.alias})
            </span>
          )}
        </p>
        <p className="text-neutral-500 text-xs mt-0.5">
          Split: {model.revenue_split_percent}% till modell
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            model.status === "active"
              ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
              : "bg-neutral-800 text-neutral-400 border border-neutral-700"
          }`}
        >
          {model.status === "active" ? "Aktiv" : "Pausad"}
        </span>
        {canEdit && (
          <button
            onClick={toggleStatus}
            className="text-xs text-neutral-400 hover:text-white transition"
          >
            Ändra
          </button>
        )}
      </div>
    </div>
  );
}
