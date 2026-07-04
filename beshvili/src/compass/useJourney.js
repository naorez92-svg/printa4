import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { STAGES } from "./data/questions";

// מצפן journey state: a small state machine persisted to localStorage on every
// change (the journey may span days and survives login redirects), and mirrored
// to the career_journeys row once the user is authenticated (cross-device resume
// + the Edge Function's per-journey rate accounting hangs off that row).

const LS_KEY = "compass_journey_v1";

const EMPTY = {
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
    // Unknown stage (old version / tampering) → restart rather than crash.
    if (!STAGES.some((s) => s.id === parsed.stage)) return { ...EMPTY };
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function useJourney(session) {
  const [journey, setJourney] = useState(loadLocal);
  const syncTimer = useRef(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;

  // Persist locally on every change; mirror to Supabase debounced (2s) when
  // logged in — the journey generates a burst of tiny updates per screen.
  const update = useCallback((patch) => {
    setJourney((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage full/blocked */ }
      return next;
    });
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

  // Debounced mirror of the current journey into its row.
  useEffect(() => {
    if (!session?.user || !journey.rowId) return;
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
    }, 2000);
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

  const goToStage = useCallback((stageId) => update({ stage: stageId }), [update]);

  const nextStage = useCallback(() => {
    update((prev) => {
      const idx = STAGES.findIndex((s) => s.id === prev.stage);
      const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
      return { ...prev, stage: next.id };
    });
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
