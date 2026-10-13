"use client";

import { api, type TestResults } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Banner, Icon, SectionLabel, toneClass } from "@/components/ui";
import { ErrorState, Loading } from "@/components/states";
import { Inline, Markdown, stripMd } from "@/components/Markdown";

type Tone = "ok" | "warn" | "danger" | "neutral";

/** Colour is only a hint: the Pass/Fail words from the report are always printed. */
function scenarioTone(cell: string): Tone {
  const t = stripMd(cell).toLowerCase();
  if (t.startsWith("fail")) return "danger";
  if (t.startsWith("pass")) return /fail|có điều kiện|hạn chế/.test(t) ? "warn" : "ok";
  return "warn"; // "CẦN CHẤM TAY" and anything unrecognised: never shown as a pass
}

function metricTone(cell: string): Tone {
  const t = stripMd(cell).toLowerCase();
  const neg = /chưa đạt|không đo|không đánh giá|không kiểm/.test(t);
  const pos = /đạt/.test(t.replace(/chưa đạt/g, ""));
  if (neg && pos) return "warn";
  if (neg) return "danger";
  if (pos) return "ok";
  return "neutral";
}

function StatusCell({ text, tone }: { text: string; tone: Tone }) {
  const icon = tone === "ok" ? "check" : tone === "danger" ? "x" : tone === "warn" ? "alert" : "info";
  return (
    <span className={`inline-flex items-start gap-1.5 rounded-lg border px-2 py-1 text-[14px] font-medium ${toneClass(tone)}`}>
      <span className="mt-1"><Icon name={icon} size={14} /></span>
      <span><Inline text={text} /></span>
    </span>
  );
}

function ScenarioTable({ data }: { data: TestResults }) {
  const header = data.scenario_table_header;
  const rows = data.scenario_table.filter((r) => r.length === header.length && /^T\d/.test(r[0]));
  if (rows.length === 0) {
    return <Banner tone="danger" title="Không đọc được bảng T1-T9 từ báo cáo">Báo cáo không có bảng đúng định dạng; không có số liệu thay thế.</Banner>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[760px] border-collapse text-[14px]">
        <thead className="bg-subtle text-left">
          <tr>{header.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-line align-top">
              <th scope="row" className="px-3 py-2 text-left font-semibold"><Inline text={r[0]} /></th>
              <td className="px-3 py-2"><StatusCell text={r[1]} tone={scenarioTone(r[1])} /></td>
              <td className="px-3 py-2"><StatusCell text={r[2]} tone={scenarioTone(r[2])} /></td>
              <td className="px-3 py-2"><Inline text={r[3]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsTable({ rows }: { rows: string[][] }) {
  if (rows.length < 2) return <p className="text-muted">Báo cáo không có bảng chỉ số.</p>;
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[820px] border-collapse text-[14px]">
        <thead className="bg-subtle text-left">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {body.filter((r) => r.length === head.length).map((r) => (
            <tr key={r[0]} className="border-t border-line align-top">
              <th scope="row" className="px-3 py-2 text-left font-semibold"><Inline text={r[0]} /></th>
              <td className="px-3 py-2"><Inline text={r[1]} /></td>
              <td className="px-3 py-2"><Inline text={r[2]} /></td>
              <td className="px-3 py-2"><StatusCell text={r[3]} tone={metricTone(r[3])} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScenarioDetails({ md }: { md: string }) {
  const parts = md.split(/^### /m).slice(1); // part 0 is the summary table, already shown above
  if (parts.length === 0) return null;
  return (
    <div className="space-y-2">
      {parts.map((p) => {
        const nl = p.indexOf("\n");
        const title = nl === -1 ? p : p.slice(0, nl);
        const body = nl === -1 ? "" : p.slice(nl + 1);
        return (
          <details key={title} className="rounded-lg border border-line bg-surface p-3">
            <summary className="cursor-pointer font-semibold"><Inline text={title.trim()} /></summary>
            <Markdown text={body} className="mt-3 text-[15px]" />
          </details>
        );
      })}
    </div>
  );
}

export default function TestResultsPage() {
  const { state, reload } = useApi(() => api.testResults(), "test-results");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <SectionLabel>Kết quả kiểm thử</SectionLabel>
      <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">Kết quả kiểm thử T1-T9</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Toàn bộ nội dung trang này được đọc từ báo cáo mới nhất do evaluator (người chấm độc lập) viết, qua API. Không có
        con số nào được gõ tay vào giao diện. Tỷ lệ đạt không được làm đẹp: các kịch bản Fail được giữ nguyên.
      </p>

      <div className="mt-6 space-y-6">
        {state.status === "loading" && <Loading what="báo cáo kiểm thử" />}
        {state.status === "error" && <ErrorState error={state.error} onRetry={reload} title="Không đọc được báo cáo kiểm thử" />}
        {state.status === "ok" && (
          <>
            <Banner tone="neutral" title={state.data.title}>
              <span>
                Báo cáo đầy đủ: <span className="font-mono">tests/reports/{state.data.report_file}</span>
              </span>
            </Banner>

            <section className="card" aria-labelledby="sum-h">
              <SectionLabel>Tóm tắt trung thực</SectionLabel>
              <h2 id="sum-h" className="sr-only">Tóm tắt</h2>
              <Markdown text={state.data.summary_markdown} className="mt-2" />
            </section>

            <section className="card" aria-labelledby="t-h">
              <SectionLabel>Bảng T1-T9</SectionLabel>
              <h2 id="t-h" className="mt-1 text-xl font-semibold">Điểm máy so với điểm chấm tay của evaluator</h2>
              <p className="mt-1 text-[14px] text-muted">
                Điểm máy là kiểm tra tự động thô; điểm tay là kết luận cuối. Màu chỉ hỗ trợ, chữ Pass/Fail luôn hiển thị.
              </p>
              <div className="mt-3"><ScenarioTable data={state.data} /></div>
              <h3 className="mb-2 mt-5 text-[16px] font-semibold">Chi tiết từng kịch bản (kỳ vọng, kết quả thực tế, bài học)</h3>
              <ScenarioDetails md={state.data.scenario_details_markdown} />
            </section>

            <section className="card" aria-labelledby="m-h">
              <SectionLabel>Chỉ số</SectionLabel>
              <h2 id="m-h" className="mt-1 text-xl font-semibold">Chỉ số so với mục tiêu đề xuất</h2>
              <p className="mt-1 text-[14px] text-muted">Mục tiêu chưa đạt được ghi nhận là chưa đạt, không hạ ngưỡng.</p>
              <div className="mt-3"><MetricsTable rows={state.data.metrics_table} /></div>
            </section>

            {state.data.baseline_markdown && (
              <section className="card" aria-labelledby="b-h">
                <SectionLabel>So sánh với baseline (T8)</SectionLabel>
                <h2 id="b-h" className="sr-only">So sánh với baseline</h2>
                <details className="mt-1" open>
                  <summary className="cursor-pointer font-semibold">Số liệu so sánh MVP với câu trả lời trực tiếp của LLM</summary>
                  <Markdown text={state.data.baseline_markdown} className="mt-3" />
                </details>
              </section>
            )}

            <section className="card" aria-labelledby="l-h">
              <SectionLabel>Giới hạn của bộ kiểm thử</SectionLabel>
              <h2 id="l-h" className="sr-only">Giới hạn của bộ kiểm thử</h2>
              <Markdown text={state.data.limitations_of_suite_markdown} className="mt-2" />
            </section>

            <p className="text-[14px] text-muted">
              Báo cáo đầy đủ: <span className="font-mono">tests/reports/{state.data.report_file}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
