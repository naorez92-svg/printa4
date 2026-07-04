import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";
import { STAGES } from "./data/questions";

// מצפן journey state: a small state machine persisted to localStorage on every
// change (the journey may span days and survives login redirects), and mirrored
// to the career_journeys row once the user is authenticated (cross-device resume
// + the Edge Function's per-journey rate accounting hangs off that row).

const LS_KEY = "compass_journey_v1";

const SCHEMA_V = 1;

const EMPTY = {
  v: SCHEMA_V,
  rowId: null,
  stage: "welcome",
  answers: {},      // { background, riasec, values, bigfive, cognitive, open }
  interview: [],    // [{ q, a }]
  report: null,     // { raw, sections } once analysis completes
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    // Wrong schema version or unknown stage (old build / tampering) → restart
    // rather than feed a stale shape into scoring and crash mid-journey.
    if (parsed.v !== SCHEMA_V || !STAGES.some((s) => s.id === parsed.stage)) return { ...EMPTY };
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function useJourney(session) {
  const [journey, setJourney] = useState(loadLocal);
  const syncTimer = useRef(null);
  const lsTimer = useRef(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;

  // Persist locally (debounced — textareas fire update() per keystroke and a
  // full-journey JSON.stringify per character janks mobile typing); mirror to
  // Supabase debounced when logged in.
  const update = useCallback((patch) => {
    setJourney((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      journeyRef.current = next;
      clearTimeout(lsTimer.current);
      lsTimer.current = setTimeout(() => {
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage full/blocked */ }
      }, 250);
      return next;
    });
  }, []);

  // Flush the pending localStorage write when the page goes to background /
  // unloads, so the 250ms debounce can't lose the last keystrokes.
  useEffect(() => {
    const flush = () => {
      clearTimeout(lsTimer.current);
      try { localStorage.setItem(LS_KEY, JSON.stringify(journeyRef.current)); } catch { /* ignore */ }
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Ensure a career_journeys row exists for this user (needed before any AI
  // call — the Edge Function rate-limits per row). Returns the row id.
  const ensureRow = useCallback(async () => {
    const j = journeyRef.current;
    if (!session?.user) return null;
    if (j.rowId) return j.rowId;
    const { data, error } = await supabase
      .from("career_journeys")
      .insert({ user_id: session.user.id, stage: j.stage, answers: j.answers, interview: j.interview })
      .select("id")
      .single();
    if (error || !data) return null;
    update({ rowId: data.id });
    return data.id;
  }, [session, update]);

  // Debounced mirror of the current journey into its row. The completed report
  // syncs immediately — it's the one write that must not be lost to the
  // debounce window if the user closes the tab right after finishing.
  useEffect(() => {
    if (!session?.user || !journey.rowId) return;
    const delay = journey.stage === "report" && journey.report ? 0 : 2000;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      supabase
        .from("career_journeys")
        .update({
          stage: journey.stage,
          answers: journey.answers,
          interview: journey.interview,
          report: journey.report,
          status: journey.stage === "report" ? "completed" : "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", journey.rowId)
        .then(() => {}, () => {});
    }, delay);
    return () => clearTimeout(syncTimer.current);
  }, [session, journey]);

  // On login with a fresh local journey, resume the newest journey from the DB
  // (cross-device / cleared-storage recovery). Local progress always wins.
  useEffect(() => {
    if (!session?.user) return;
    const j = journeyRef.current;
    const localHasProgress = j.stage !== "welcome" || Object.keys(j.answers).length > 0;
    if (localHasProgress) return;
    supabase
      .from("career_journeys")
      .select("id, stage, answers, interview, report")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && STAGES.some((s) => s.id === data.stage)) {
          update({
            rowId: data.id,
            stage: data.stage,
            answers: data.answers || {},
            interview: data.interview || [],
            report: data.report || null,
          });
        }
      }, () => {});
  }, [session, update]);

  const goToStage = useCallback((stageId) => {
    track("compass_stage", { stage: stageId });
    update({ stage: stageId });
  }, [update]);

  const nextStage = useCallback(() => {
    const idx = STAGES.findIndex((s) => s.id === journeyRef.current.stage);
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
    track("compass_stage", { stage: next.id });
    update({ stage: next.id });
  }, [update]);

  const saveSection = useCallback((key, data) => {
    update((prev) => ({ ...prev, answers: { ...prev.answers, [key]: data } }));
  }, [update]);

  const restart = useCallback(() => {
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    setJourney({ ...EMPTY });
  }, []);

  return { journey, update, ensureRow, goToStage, nextStage, saveSection, restart };
}

// Progress fraction for the header bar — welcome/report excluded from the count.
export function journeyProgress(stageId) {
  const steps = STAGES.slice(1, -1);
  const idx = steps.findIndex((s) => s.id === stageId);
  if (stageId === "report") return 1;
  if (idx < 0) return 0;
  return idx / steps.length;
}
