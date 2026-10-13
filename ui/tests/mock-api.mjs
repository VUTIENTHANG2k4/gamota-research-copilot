// Local mock used ONLY to exercise UI error/special states that the saved data cannot show
// (live-run error, clarification run, database-down chunk). It proxies everything else to the real API.
// Usage: node tests/mock-api.mjs   (listens on :8001; the real API must run on :8000)
import http from "node:http";

const REAL = "http://localhost:8000";
const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
  res.end(JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (url.pathname === "/api/runs" && req.method === "GET") {
    const real = await (await fetch(REAL + "/api/runs")).json();
    return send(res, 200, [...real, { key: "AMB", label: "MOCK: câu hỏi mơ hồ", question: "Thị trường game casual thế nào?", origin: "saved", origin_note: "MOCK cục bộ để thử giao diện" }]);
  }
  if (url.pathname === "/api/runs/AMB") {
    return send(res, 200, { key: "AMB", question: "Thị trường game casual thế nào?", needs_clarification: true, subs: [], memo_real: null, memo_test: null, baseline: null,
      brief: { decision: "", scope: "", needs_clarification: true, sub_questions: [], clarifying_questions: ["Quyết định nào cần hỗ trợ?", "Phạm vi thị trường và nền tảng?", "Loại casual và khung thời gian?"] } });
  }
  if (url.pathname === "/api/runs" && req.method === "POST") return send(res, 200, { job_id: "mockjob1", key: "live-mockjob1" });
  if (url.pathname === "/api/jobs/mockjob1") {
    globalThis.n = (globalThis.n ?? 0) + 1;
    if (globalThis.n < 2) return send(res, 200, { status: "running", stage: "truy xuất và trích claim", key: "live-mockjob1", question: "q" });
    return send(res, 200, { status: "error", stage: "truy xuất và trích claim", key: "live-mockjob1", question: "q", error: "RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)" });
  }
  if (url.pathname.startsWith("/api/chunks/")) return send(res, 503, { detail: "Không kết nối được cơ sở dữ liệu: OperationalError" });
  const r = await fetch(REAL + url.pathname + url.search);
  res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8001, () => console.log("mock on 8001"));
