import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";
import { parseReport } from "./api";
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
  dismissedRowId: null, // set by restart() — blocks the DB-resume effect from resurrecting the old journey
  stage: "welcome",
  answers: {},      // { background, riasec, values, bigfive, cognitive, open }
  interview: [],    // [{ q, a }]
  report: null,     // { raw, sections } once analysis completes
  roadmapDone: {},  // { "stepIdx-lineIdx": true } — the live action-plan checkmarks
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
  const reportSynced = useRef(false);
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
  //
  // Two guards protect the server-persisted report from stale clobbers:
  //  • during "analysis" with no local report there is nothing new to mirror —
  //    and the server may be writing the report to this row right now;
  //  • report/status are included in the payload only when a report exists, so
  //    a mirror can never overwrite a saved report with null.
  useEffect(() => {
    if (!session?.user || !journey.rowId) return;
    if (journey.stage === "analysis" && !journey.report) return;
    // 0-delay only for the FIRST sync that carries the completed report (the
    // one write that must not be lost); roadmap toggles afterwards use the
    // normal debounce so 10 quick checkmarks aren't 10 full-row writes.
    const firstReportSync = journey.stage === "report" && journey.report && !reportSynced.current;
    const delay = firstReportSync ? 0 : 2000;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const payload = {
        stage: journey.stage,
        answers: journey.answers,
        interview: journey.interview,
        roadmap_done: journey.roadmapDone || {},
        updated_at: new Date().toISOString(),
      };
      if (journey.report) {
        payload.report = journey.report;
        payload.status = journey.stage === "report" ? "completed" : "in_progress";
        reportSynced.current = true;
      }
      supabase
        .from("career_journeys")
        .update(payload)
        .eq("id", journey.rowId)
        .then(({ error }) => {
          // Deploy-ordering resilience: if migration 0040 hasn't landed yet
          // (or its workflow failed), the roadmap_done column/grant doesn't
          // exist and the WHOLE update is rejected. Never let the new column
          // take down core journey sync — retry without it.
          if (error && /roadmap_done/i.test(error.message || "")) {
            const { roadmap_done: _drop, ...rest } = payload;
            supabase.from("career_journeys").update(rest).eq("id", journey.rowId)
              .then(() => {}, () => {});
          }
        }, () => {});
    }, delay);
    return () => clearTimeout(syncTimer.current);
  }, [session, journey]);

  // On login, reconcile with the newest journey row in the DB:
  //  • Fresh local state → resume the DB journey (cross-device / cleared storage).
  //  • Same journey, and the SERVER holds a report the client missed (stream
  //    died after the server persisted it) → adopt the report. The last thing
  //    that happened is never lost.
  // Otherwise local progress wins.
  useEffect(() => {
    if (!session?.user) return;
    const applyRow = (data) => {
      if (!data || !STAGES.some((s) => s.id === data.stage)) return;
      // A journey the user explicitly restarted away from stays dismissed.
      if (data.id === journeyRef.current.dismissedRowId) return;
      // Server-saved reports carry only {raw} — normalize to {raw, sections}.
      const normReport = data.report?.raw
        ? { raw: data.report.raw, sections: data.report.sections || parseReport(data.report.raw) }
        : null;
      const j = journeyRef.current;
      const localHasProgress = j.stage !== "welcome" || Object.keys(j.answers).length > 0;
      // Checkmark merge is a UNION: a checkmark set on any device is never
      // destroyed by a device that hasn't seen it yet. (Tradeoff: an uncheck
      // can be resurrected by a stale device — losing checks is worse.)
      const mergedDone = { ...(data.roadmap_done || {}), ...(j.roadmapDone || {}) };
      if (!localHasProgress) {
        update({
          rowId: data.id,
          stage: data.stage,
          answers: data.answers || {},
          interview: data.interview || [],
          report: normReport,
          roadmapDone: mergedDone,
        });
      } else if (j.rowId === data.id && normReport && !j.report) {
        update({ report: normReport, stage: "report", roadmapDone: mergedDone });
      } else if (j.rowId === data.id &&
                 Object.keys(mergedDone).length !== Object.keys(j.roadmapDone || {}).length) {
        update({ roadmapDone: mergedDone });
      }
    };
    supabase
      .from("career_journeys")
      .select("id, stage, answers, interview, report, roadmap_done")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) return applyRow(data);
        // Migration 0040 not applied yet → the column doesn't exist and the
        // whole select fails. Resume must keep working — retry without it.
        supabase
          .from("career_journeys")
          .select("id, stage, answers, interview, report")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: d2 }) => applyRow(d2), () => {});
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
    // Keep a tombstone for the abandoned journey so the DB-resume effect
    // doesn't resurrect it on the next mount (its report stays safe in the DB).
    const fresh = { ...EMPTY, dismissedRowId: journeyRef.current.rowId || journeyRef.current.dismissedRowId };
    journeyRef.current = fresh;
    try { localStorage.setItem(LS_KEY, JSON.stringify(fresh)); } catch { /* ignore */ }
    setJourney(fresh);
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
