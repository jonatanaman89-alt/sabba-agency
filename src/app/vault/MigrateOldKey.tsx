"use client";

// TILLFÄLLIGT ENGÅNGSVERKTYG — ta bort denna fil och dess användning i
// page.tsx/VaultClient.tsx när alla poster är migrerade (dvs. kör en gång,
// bekräfta att allt går att läsa på Konton-sidan, och radera sen).
//
// Konton-sidan har bytt från en mänskligt inmatad huvudnyckel till en fast
// inbyggd nyckel (se vaultCrypto.ts). Poster som redan sparades med den
// gamla huvudnyckeln går inte att läsa med den nya nyckeln förrän de
// krypterats om. Det här verktyget gör exakt det: matar in din gamla
// huvudnyckel en sista gång, dekrypterar varje post, och sparar om den
// krypterad med den nya fasta nyckeln.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { encryptSecret, decryptSecret, FIXED_VAULT_PASSPHRASE } from "@/lib/crypto/vaultCrypto";

type VaultItem = {
  id: string;
  encrypted_secret: string;
  iv: string;
  service_name: string;
};

export function MigrateOldKey({ items }: { items: VaultItem[] }) {
  const supabase = createClient();
  const [oldKey, setOldKey] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function runMigration() {
    setRunning(true);
    setDone(false);
    const lines: string[] = [];

    for (const item of items) {
      try {
        const plain = await decryptSecret(item.encrypted_secret, item.iv, oldKey);
        const { encrypted_secret, iv } = await encryptSecret(
          plain,
          FIXED_VAULT_PASSPHRASE
        );
        const { error } = await supabase
          .from("vault_items")
          .update({ encrypted_secret, iv })
          .eq("id", item.id);
        if (error) throw error;
        lines.push(`✅ ${item.service_name}`);
      } catch {
        lines.push(`❌ ${item.service_name} — fel gammal nyckel eller redan migrerad`);
      }
    }

    setLog(lines);
    setRunning(false);
    setDone(true);
  }

  return (
    <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-5 mb-6">
      <p className="text-amber-300 text-sm font-medium mb-1">
        ⚠️ Engångsmigrering krävs
      </p>
      <p className="text-neutral-300 text-sm mb-3">
        Konton-sidan visar nu lösenord direkt utan huvudnyckel. {items.length}{" "}
        befintliga poster sparades med den gamla huvudnyckeln och måste
        krypteras om en gång innan de går att läsa. Ange den gamla
        huvudnyckeln nedan och kör migreringen.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="password"
          value={oldKey}
          onChange={(e) => setOldKey(e.target.value)}
          placeholder="Gamla huvudnyckeln"
          className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
        />
        <button
          onClick={runMigration}
          disabled={!oldKey || running}
          className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 transition"
        >
          {running ? "Migrerar…" : "Kör migrering"}
        </button>
      </div>
      {log.length > 0 && (
        <div className="mt-3 text-xs font-mono space-y-0.5">
          {log.map((line, i) => (
            <p key={i} className="text-neutral-400">
              {line}
            </p>
          ))}
        </div>
      )}
      {done && (
        <p className="text-emerald-400 text-sm mt-3">
          Klart. Ladda om sidan — lösenorden ska nu visas direkt. Säg till
          mig när det är bekräftat så tar jag bort den här rutan permanent.
        </p>
      )}
    </div>
  );
}
