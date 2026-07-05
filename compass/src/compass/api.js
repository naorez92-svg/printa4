import { supabase } from "../lib/supabase";
import { buildProfile } from "./scoring";

// מצפן — client for the career-compass Edge Function (v2, two-phase analysis).

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-compass`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });
  return {
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

function apiError(data) {
  const err = new Error(data.error || "ai_error");
  err.code = data.error || "ai_error";
  err.wait = data.wait;
  return err;
}

// Ask the interviewer agent for the next adaptive question.
export async function fetchInterviewQuestion(journeyId, answers, interview) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "interview", journeyId, profile: buildProfile(answers), interview }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(data);
  return data;
}

// Shared SSE runner for the analysis phases. onEvent receives every parsed
// `data:` event — both our control events ({type:"agent_done"|"done"|"error"...})
// and, during synthesis, raw Anthropic events ({type:"content_block_delta"...}).
async function streamAction(action, journeyId, answers, interview, onEvent, signal) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action, journeyId, profile: buildProfile(answers), interview }),
    signal,
  });
  if (!res.ok) throw apiError(await res.json().catch(() => ({})));

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
      // error events, and that error must propagate out of the stream loop.
      onEvent(evt);
    }
  }
}

export const streamExperts = (journeyId, answers, interview, onEvent, signal) =>
  streamAction("experts", journeyId, answers, interview, onEvent, signal);

export const streamSynthesis = (journeyId, answers, interview, onEvent, signal) =>
  streamAction("synthesize", journeyId, answers, interview, onEvent, signal);

// ── Admin (the /admin dashboard; server verifies plan='admin') ──
export async function adminStats() {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "admin_stats" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(data);
  return data;
}

export async function adminSetPaid(email, paid) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "admin_set_paid", email, paid }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(data);
  return data;
}

// Paywall entitlement — read from profiles (server enforces it independently).
export async function checkCompassPaid() {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("compass_paid, plan")
    .eq("id", user.id)
    .maybeSingle();
  return data?.compass_paid === true || data?.plan === "admin";
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
