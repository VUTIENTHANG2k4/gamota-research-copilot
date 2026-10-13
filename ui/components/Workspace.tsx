"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Run } from "@/lib/api";
import { claimIndex } from "@/lib/text";
import { SourcePanel } from "./SourcePanel";
import { ClaimChip } from "./ui";
import type { Claim } from "@/lib/api";

interface Sel {
  selectedId: string | null;
  select: (id: string) => void;
  index: Map<string, Claim>;
}
const SelCtx = createContext<Sel>({ selectedId: null, select: () => {}, index: new Map() });
export const useClaimSelection = () => useContext(SelCtx);

/** Two-column layout: document on the left, source-passage panel on the right (under it below ~1060px). */
export function Workspace({ run, children }: { run: Run; children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => claimIndex(run), [run]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    // Single-column layout: the panel is below the document, so bring it into view.
    if (window.innerWidth < 1060) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, []);

  const claim = selectedId ? (index.get(selectedId) ?? null) : null;

  return (
    <SelCtx.Provider value={{ selectedId, select, index }}>
      <div className="grid gap-6 min-[1060px]:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] min-[1060px]:items-start">
        <div className="min-w-0">{children}</div>
        <div ref={panelRef} className="min-w-0 scroll-mt-4 min-[1060px]:sticky min-[1060px]:top-4 min-[1060px]:max-h-[calc(100vh-2rem)] min-[1060px]:overflow-y-auto">
          <SourcePanel claim={claim} run={run} onClear={() => setSelectedId(null)} />
        </div>
      </div>
    </SelCtx.Provider>
  );
}

/** A claim chip that opens the source panel. Unknown IDs are shown as a plain chip (never hidden). */
export function ClaimRef({ id }: { id: string }) {
  const { selectedId, select, index } = useClaimSelection();
  const claim = index.get(id);
  if (!claim) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink px-2 py-0.5 text-[13px]">
        <span className="font-mono">{id}</span> không có trong dữ liệu lần chạy
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => select(id)}
      aria-pressed={selectedId === id}
      aria-label={`Mở đoạn gốc của ${id}, hạng ${claim.grade}`}
      className="cursor-pointer rounded-full text-left"
    >
      <ClaimChip id={id} grade={claim.grade} selected={selectedId === id} />
    </button>
  );
}
