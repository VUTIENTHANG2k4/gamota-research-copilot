"use client";

// Mission 3 follow-up: continue the research from a finished run with its context kept (POST /api/runs/{id}/followup),
// and show on a follow-up run what it inherited from its parent.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiHttpError, type Run, type RunContext, type RunSummary } from "@/lib/api";
import { errorText } from "@/lib/text";
import { Icon, SectionLabel } from "./ui";

const Q_MIN = 3;
const Q_MAX = 400;
const MAX_CHAIN = 3; // backend service.MAX_DEPTH; the server enforces it and answers 409

/** Parent's context as the server will build it (same rules as api/service.py followup_context), for preview. */
function previewContext(run: Run): Required<Omit<RunContext, "inherit">> {
  const claims = run.subs.flatMap((s) => s.claims);
  const rejected = new Set(claims.filter((c) => c.review === "rejected").map((c) => c.claim_id));
  const confirmed = new Set(claims.filter((c) => c.review === "confirmed").map((c) => c.claim_id));
  const bySrc = new Map<string, Set<string>>();
  for (const c of claims) {
    if (!bySrc.has(c.source_id)) bySrc.set(c.source_id, new Set());
    bySrc.get(c.source_id)!.add(c.claim_id);
  }
  const rejectedSources = [...bySrc.entries()]
    .filter(([, ids]) => ids.size > 0 && [...ids].every((i) => rejected.has(i)))
    .map(([s]) => s)
    .sort();
  return {
    parent_id: run.id,
    parent_question: run.question,
    decision: run.brief?.decision ?? "",
    scope: run.brief?.scope ?? "",
    gaps: (run.memo?.subs ?? []).filter((s) => s.refused_text).map((s) => s.text),
    rejected_claims: [...rejected].sort(),
    confirmed_claims: [...confirmed].sort(),
    rejected_sources: rejectedSources,
  };
}

function ContextList({ ctx }: { ctx: Partial<RunContext> }) {
  const gaps = ctx.gaps ?? [];
  const rc = ctx.rejected_claims ?? [];
  const cc = ctx.confirmed_claims ?? [];
  const rs = ctx.rejected_sources ?? [];
  return (
    <dl className="grid gap-x-4 gap-y-2 text-[14px] min-[640px]:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="font-semibold text-muted">Quyết định cần hỗ trợ</dt>
      <dd className="min-w-0 break-words">{ctx.decision?.trim() ? ctx.decision : "không ghi"}</dd>
      <dt className="font-semibold text-muted">Phạm vi</dt>
      <dd className="min-w-0 break-words">{ctx.scope?.trim() ? ctx.scope : "không ghi"}</dd>
      <dt className="font-semibold text-muted">Khoảng trống chưa có căn cứ ({gaps.length})</dt>
      <dd className="min-w-0 break-words">
        {gaps.length === 0 ? (
          "không có"
        ) : (
          <ul className="list-disc space-y-0.5 pl-5">
            {gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        )}
      </dd>
      <dt className="font-semibold text-muted">Quyết định duyệt</dt>
      <dd className="min-w-0 break-words">
        <span className="font-semibold text-danger-text">{rc.length} claim đã loại</span>
        {", "}
        <span className="font-semibold text-ok-text">{cc.length} claim đã xác nhận</span>
        {rc.length > 0 && <span className="block font-mono text-[12.5px] text-muted">{rc.join(", ")}</span>}
      </dd>
      <dt className="font-semibold text-muted">Nguồn đã bị loại hết claim ({rs.length})</dt>
      <dd className="min-w-0 break-words">
        {rs.length === 0 ? "không có" : <span className="font-mono">{rs.join(", ")}</span>}
        {rs.length > 0 && <span className="block text-[13px] text-muted">Claim từ các nguồn này sẽ bị loại sẵn ở lần chạy mới.</span>}
      </dd>
    </dl>
  );
}

/** Banner on a follow-up run: link to the parent and what was (or was not) inherited. */
export function FollowupBanner({ run }: { run: Run }) {
  const ctx = run.context;
  const fu = run.memo?.followup ?? null;
  if (!ctx && !fu) return null;
  const parentId = ctx?.parent_id ?? fu!.parent_id;
  const parentQ = ctx?.parent_question ?? fu!.parent_question;
  const inherit = ctx ? ctx.inherit : fu!.inherit;
  const finished = run.status === "done" && !!fu;

  let verdict: React.ReactNode;
  if (!inherit) {
    verdict = (
      <p className="font-semibold">
        Bạn đã bỏ bối cảnh kế thừa trước khi hỏi: lần chạy này được nghiên cứu như một câu hỏi mới, không dùng phạm vi,
        khoảng trống hay quyết định duyệt của lần trước.
      </p>
    );
  } else if (!finished) {
    verdict = (
      <p>
        Bối cảnh dưới đây đã được gửi kèm câu hỏi. Chưa biết câu hỏi mới có liên quan tới câu hỏi trước hay không cho tới khi
        lần chạy xong.
      </p>
    );
  } else if (!fu!.related) {
    verdict = (
      <p className="font-semibold">
        Câu hỏi mới được đánh giá là KHÔNG liên quan tới câu hỏi trước, nên không kế thừa gì: không dùng phạm vi, khoảng
        trống hay quyết định duyệt của lần trước (0 quyết định được áp dụng lại).
      </p>
    );
  } else {
    verdict = (
      <p>
        Câu hỏi mới liên quan tới câu hỏi trước. Đã kế thừa phạm vi, khoảng trống và{" "}
        <strong className="tabular">{fu!.inherited}</strong> quyết định duyệt (claim mang nhãn &quot;kế thừa từ
        {" "}{parentId}&quot; ở bước Kho bằng chứng; bạn vẫn có thể hoàn tác).
      </p>
    );
  }

  return (
    <section aria-labelledby="fu-banner-h" className="rounded-xl border-2 border-accent/70 bg-surface p-5">
      <p className="label-mono flex items-center gap-1.5"><Icon name="branch" size={14} /> Nghiên cứu tiếp</p>
      <h2 id="fu-banner-h" className="mt-1 text-[17px] font-semibold">
        Tiếp nối từ câu hỏi:{" "}
        <Link href={`/runs/${encodeURIComponent(parentId)}/memo`} className="text-accent underline">
          {parentQ}
        </Link>
      </h2>
      <div className="mt-2 text-[14px]">{verdict}</div>
      {inherit && ctx && (
        <details className="mt-3 rounded-lg border border-line bg-subtle p-3" open={!finished || fu?.related !== false}>
          <summary className="cursor-pointer text-[14px] font-semibold">Bối cảnh đã gửi kèm (bối cảnh kế thừa)</summary>
          <div className="mt-2"><ContextList ctx={ctx} /></div>
        </details>
      )}
    </section>
  );
}

/** "Nghiên cứu tiếp" box on a finished run. */
export function FollowupBox({ run }: { run: Run }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [inherit, setInherit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [children, setChildren] = useState<RunSummary[]>([]);
  const ctx = useMemo(() => previewContext(run), [run]);

  useEffect(() => {
    let alive = true;
    api.runs().then(
      (all) => alive && setChildren(all.filter((r) => r.parent_id === run.id && !r.question.includes("(Làm rõ:"))),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [run.id]);

  if (run.status !== "done") return null;

  const len = question.trim().length;
  const valid = len >= Q_MIN && len <= Q_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.followup(run.id, question.trim(), inherit);
      router.push(`/runs/${encodeURIComponent(r.id)}`);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiHttpError && err.status === 409) setError({ title: "Không thể nghiên cứu tiếp từ lần chạy này", text: err.detail });
      else if (err instanceof ApiHttpError && err.status === 429) setError({ title: "Hệ thống đang bận", text: err.detail });
      else if (err instanceof ApiHttpError && err.status === 503) setError({ title: "Kho tài liệu chưa sẵn sàng", text: err.detail });
      else setError({ title: "Chưa gửi được câu hỏi", text: errorText(err) });
    }
  }

  return (
    <section aria-labelledby="fu-box-h" className="no-print card border-2 !border-accent/70">
      <SectionLabel>Nghiên cứu tiếp</SectionLabel>
      <h2 id="fu-box-h" className="mt-1 text-xl font-semibold">Hỏi tiếp, giữ nguyên bối cảnh của lần chạy này</h2>
      <p className="mt-1 text-[14px] text-muted">Mất vài phút; tối đa {MAX_CHAIN} bước nối tiếp.</p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="fu-q" className="block text-[14px] font-semibold">Câu hỏi tiếp theo</label>
          <textarea
            id="fu-q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
            rows={3}
            maxLength={Q_MAX + 50}
            aria-describedby="fu-q-hint"
            className="mt-1 w-full resize-y rounded-lg border border-ink/50 bg-surface p-3 text-[15px] disabled:bg-subtle"
          />
          <p id="fu-q-hint" className={`mt-1 text-[13px] ${len > 0 && !valid ? "font-semibold text-danger-text" : "text-muted"}`}>
            {len}/{Q_MAX} ký tự (tối thiểu {Q_MIN}).
          </p>
        </div>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-[14px] font-semibold">Bối cảnh kế thừa từ lần chạy này</legend>
          <details>
            <summary className="cursor-pointer text-[14px] font-medium text-accent">
              Xem bối cảnh sẽ gửi kèm (phạm vi, khoảng trống, quyết định duyệt)
            </summary>
            <div className="mt-3">
              <ContextList ctx={ctx} />
            </div>
          </details>
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-ink/40 bg-subtle p-3 text-[14px]">
            <input
              type="checkbox"
              checked={!inherit}
              onChange={(e) => setInherit(!e.target.checked)}
              disabled={busy}
              className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span>
              <strong>Bỏ bối cảnh kế thừa</strong>: hỏi như một câu hỏi mới.
            </span>
          </label>
          {!inherit && (
            <p role="status" className="mt-2 rounded border border-warn-border bg-warn-bg p-2 text-[14px] font-medium text-warn-text">
              Sẽ KHÔNG gửi bối cảnh ở trên. Các claim bạn đã loại ở lần chạy này có thể xuất hiện lại.
            </p>
          )}
        </fieldset>

        <button type="submit" disabled={!valid || busy} className="btn btn-primary">
          {busy ? "Đang gửi..." : inherit ? "Nghiên cứu tiếp với bối cảnh này" : "Nghiên cứu tiếp, không kế thừa"}
        </button>
        {error && (
          <div role="alert" className="rounded-lg border border-danger-text/50 bg-danger-bg p-3 text-danger-text">
            <p className="font-semibold">{error.title}</p>
            <p className="text-[14px]">{error.text}</p>
          </div>
        )}
      </form>

      {children.length > 0 && (
        <p className="mt-4 text-[14px]">
          Đã có {children.length} lần nghiên cứu tiếp từ câu hỏi này:{" "}
          {children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && "; "}
              <Link href={`/runs/${encodeURIComponent(c.id)}/memo`} className="font-semibold text-accent underline">
                {c.question}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}
