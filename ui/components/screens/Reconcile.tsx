"use client";

import { useMemo } from "react";
import { useRun } from "@/components/RunProvider";
import { Banner, SectionLabel, SyntheticTag, Icon, toneClass } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { Inline } from "@/components/Markdown";
import { ClaimRef, Workspace, useClaimSelection } from "@/components/Workspace";
import type { Conflict } from "@/lib/api";
import { causeVi, dateOrUnknown, splitBullets } from "@/lib/text";

interface Entry {
  conflict: Conflict;
  subIds: string[];
}

function Side({ id, label }: { id: string; label: string }) {
  const { index } = useClaimSelection();
  const c = index.get(id);
  return (
    <div className="min-w-0 rounded-lg border border-line bg-subtle p-4">
      <p className="label-mono">{label}</p>
      <div className="mt-2"><ClaimRef id={id} /></div>
      {c ? (
        <>
          <p className="mt-2 text-[16px] font-medium">{c.content}</p>
          <dl className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[14px]">
            <dt className="text-muted">Nguồn</dt>
            <dd className="break-words">
              <span className="font-mono">{c.source_id}</span>: {c.source.title}
              {c.is_synthetic && <> <SyntheticTag className="align-middle" /></>}
            </dd>
            <dt className="text-muted">Năm / ngày dữ liệu</dt>
            <dd>{dateOrUnknown(c.src_data_date)}</dd>
            <dt className="text-muted">Phạm vi</dt>
            <dd className="break-words">{c.scope ?? "không ghi"}</dd>
          </dl>
        </>
      ) : (
        <p className="mt-2 text-muted">Claim này không có trong dữ liệu lần chạy.</p>
      )}
    </div>
  );
}

function ConflictCard({ e, n }: { e: Entry; n: number }) {
  const c = e.conflict;
  const explained = c.status === "explained";
  const bullets = splitBullets(c.usage_suggestion || "");
  return (
    <article
      className={`card !p-5 sm:!p-6 ${explained ? "" : "border-2 border-danger-text"}`}
      aria-labelledby={`cf-${n}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span id={`cf-${n}`} className="label-mono">Mâu thuẫn {n} · {e.subIds.join(", ")}</span>
        <span className={`inline-flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-[13px] font-semibold ${toneClass(explained ? "ok" : "danger")}`}>
          <Icon name={explained ? "check" : "alert"} size={14} />
          {explained ? "Đã giải thích nguyên nhân" : "Chưa giải thích được"}
        </span>
        {c.synthetic_involved && <SyntheticTag />}
        {typeof c.relative_diff === "number" && (
          <span className="text-[13px] text-muted">
            chênh lệch tương đối {(c.relative_diff * 100).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}%
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 min-[700px]:grid-cols-2">
        <Side id={c.claim_a} label="Claim A" />
        <Side id={c.claim_b} label="Claim B" />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <SectionLabel>Nguyên nhân</SectionLabel>
          <p className="mt-1 font-semibold">{causeVi(c.cause)}</p>
          <p className="text-[13px] text-muted">
            Nhãn LLM gán: <span className="font-mono">{c.llm_cause ?? "không ghi"}</span> · kiểm lại bằng code:{" "}
            <span className="font-mono">{c.recheck ?? "không ghi"}</span>. Code chỉ đối chiếu nhãn với thông tin nguồn,
            không kiểm tra giải thích bên dưới.
          </p>
        </div>
        <div>
          <SectionLabel>Giải thích</SectionLabel>
          <p className="mt-1"><Inline text={c.explanation} /></p>
          <p className="mt-1 text-[13px] text-warn-text">
            Do LLM viết; có thể vượt quá bằng chứng trong kho (lỗi đã biết, xem trang Giới hạn đã biết).
          </p>
        </div>
        <div>
          <SectionLabel>Gợi ý dùng con số nào cho mục đích nào</SectionLabel>
          {bullets.length > 1 ? (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {bullets.map((b, i) => <li key={i}><Inline text={b} /></li>)}
            </ul>
          ) : (
            <p className="mt-1"><Inline text={c.usage_suggestion || "Không có gợi ý."} /></p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ReconcilePage() {
  const { run } = useRun();

  const entries = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const s of run.subs) {
      for (const cf of s.conflicts) {
        const k = [cf.claim_a, cf.claim_b].sort().join("|");
        const ex = m.get(k);
        if (ex) ex.subIds.push(s.id);
        else m.set(k, { conflict: cf, subIds: [s.id] });
      }
    }
    return [...m.values()];
  }, [run]);

  if (run.needs_clarification || run.subs.length === 0) {
    return (
      <EmptyState title="Chưa có gì để đối soát">
        Lần chạy này chưa truy xuất tài liệu nào nên không có claim để so sánh.
      </EmptyState>
    );
  }

  const unexplained = entries.filter((e) => e.conflict.status === "unexplained").length;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <SectionLabel>Bước 3: Đối soát mâu thuẫn</SectionLabel>
        <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">Đối soát mâu thuẫn</h1>
        <p className="mt-2 text-muted">
          Hai claim cùng chủ đề nhưng con số lệch nhau (code tìm cặp lệch từ 10% trở lên). Mỗi cặp có nguyên nhân và gợi ý
          dùng con số nào cho mục đích nào. Trang này chỉ để đọc.
        </p>
      </div>

      <Banner tone="neutral" title="Duyệt của chuyên viên chưa có">
        Bước duyệt claim của chuyên viên và xuất Word/PDF chưa được làm trong MVP.
      </Banner>

      <Workspace run={run}>
        {entries.length === 0 ? (
          <EmptyState title="Không phát hiện cặp claim mâu thuẫn nào">
            Điều này chỉ có nghĩa là code không thấy cặp con số lệch nhau trong các claim đã qua kiểm tra. Nó không chứng
            minh rằng các nguồn đồng thuận: claim có đơn vị hoặc phạm vi khác nhau có thể không được so sánh với nhau.
          </EmptyState>
        ) : (
          <div className="space-y-6">
            <p className="text-[15px]">
              <strong className="tabular">{entries.length}</strong> cặp mâu thuẫn
              {unexplained > 0 ? (
                <> trong đó <strong className="text-danger-text tabular">{unexplained}</strong> cặp chưa giải thích được.</>
              ) : (
                <>, đều đã có nguyên nhân (chưa được kiểm chứng độc lập).</>
              )}
            </p>
            {entries.map((e, i) => <ConflictCard key={i} e={e} n={i + 1} />)}
          </div>
        )}
      </Workspace>
    </div>
  );
}
