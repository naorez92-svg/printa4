import { supabase } from "../lib/supabase";
import { buildProfile } from "./scoring";

// מצפן — client for the career-compass Edge Function.

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-compass`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("not_authenticated");
  return {
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

// Ask the interviewer agent for the next adaptive question.
// Returns { question, index, total, done } or throws {code, wait?}.
export async function fetchInterviewQuestion(journeyId, answers, interview) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      action: "interview",
      journeyId,
      profile: buildProfile(answers),
      interview,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "ai_error");
    err.code = data.error || "ai_error";
    err.wait = data.wait;
    throw err;
  }
  return data;
}

// Run the multi-agent analysis. Streams SSE; invokes callbacks as events land.
// onEvent receives: {type: "agents_start"|"agent_done"|"synthesis_start"|"delta"|"done"|"error", ...}
export async function streamAnalysis(journeyId, answers, interview, onEvent, signal) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      action: "analyze",
      journeyId,
      profile: buildProfile(answers),
      interview,
    }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || "ai_error");
    err.code = data.error || "ai_error";
    err.wait = data.wait;
    throw err;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue; // keep-alive comment frames
      let evt;
      try {
        evt = JSON.parse(line.slice(6));
      } catch { continue; /* malformed frame — skip */ }
      // Deliberately OUTSIDE the try: the caller throws from onEvent on server
      // error events, and that error must propagate out of streamAnalysis.
      onEvent(evt);
    }
  }
}

// Split the streamed report into named sections by the @@marker@@ lines.
// Keys are normalized (whitespace → underscore) so a model writing
// "@@מפת דרכים@@" still lands on the "מפת_דרכים" section.
export function parseReport(raw) {
  const sections = {};
  const parts = raw.split(/@@([^@\n]+)@@/);
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i].trim().replace(/[\s_]+/g, "_");
    sections[key] = (parts[i + 1] || "").trim();
  }
  return sections;
}
