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
| 2026-07-27 | "Between meals" = outside the hour windows 6–10 / 12–15 / 18–21 | The spec requires an emotional-hunger question "between meals" without defining it; fixed windows are deterministic and testable |
| 2026-07-27 | Meal clarification answers are re-analyzed by the LLM (original description + user answer) and logged as high confidence | One question → log, per spec; re-analysis refines the estimate without a second question |
| 2026-07-27 | "Admin notification" for new landing leads = WARNING log + leads panel on the admin dashboard | No admin phone number defined in the spec; WhatsApp-ing the admin would need one |
| 2026-07-27 | Nudge levels stored in `missed_days_streak` (1/2/4 = 24h/48h/96h), reset to 0 on any inbound | Matches the column's meaning and avoids a new column just for nudge dedup |
