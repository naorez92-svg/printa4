# DECISIONS

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-27 | Conversation state is stored as two columns on `users` (`conversation_state`, `state_payload` JSON text) instead of a separate table | Simplest thing that works for a single-process SQLite MVP |
| 2026-07-27 | Per-user daily API caps tracked in a `user_daily_usage` table (global costs stay in `api_costs`) | The spec's `api_costs` schema has no user column, but per-user caps require per-user counts |
| 2026-07-27 | Shabbat/holiday times: internal NOAA sunset approximation for central Israel (31.9/34.8) + `pyluach` for holiday detection; `hdate` used if importable | `hdate` wheels pull heavy deps; the approximation is deterministic, dependency-free and testable |
| 2026-07-27 | Free text from an active user is first analyzed as a meal description; if the LLM returns no calories it is answered as coach chat | Avoids a separate intent-classification LLM round-trip (cost + latency) |
| 2026-07-27 | "מחק אותי / הסר" deletes personal data immediately (well within the 24h promise) | Simpler than a scheduled deletion job |
| 2026-07-27 | Weekly weigh-in request is sent on the Sunday evening check-in (fixed day) | Spec says "once a week (fixed day)"; Sunday is the Israeli week start |
| 2026-07-27 | Scheduler jobs are pure functions driven by a minute tick; APScheduler only wires the tick + daily backup | Makes every proactive flow unit-testable with freezegun |
| 2026-07-27 | The MAAMEN mono-repo lives under `maamen/` inside the existing `printa4` repository | The build ran inside printa4; all plan paths are relative to `maamen/` |
