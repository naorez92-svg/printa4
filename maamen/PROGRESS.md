# PROGRESS

- [x] Stage 1 — Skeleton: repo structure, config, DB models, logging, webhook with dedup, mocks, /dev/simulate (4 tests green). Next: LLM wrapper + onboarding.
- [x] Stage 2 — Brain: Anthropic wrapper (retry + lenient JSON), prompts.py, full onboarding, targets, commands, medical flag (13 tests green). Next: meal pipelines.
- [x] Stage 3 — Meals: vision/voice/text pipelines, 3 confidence levels, overage, emotional_flag + technique, medical support mode, commands (27 tests green). Next: proactive scheduler.
- [x] Stage 4 — Proactive: minute-tick scheduler, shabbat/holiday quiet windows, morning planning + 2h fallback, evening check-in, 24/48/96h nudges, weekly summary with TTS, daily DB backup (40 tests green). Next: admin + landing + cost guard.
- [x] Stage 5 — Admin dashboard (Basic Auth, users table, user page + weight canvas, manual send, add beta user) + landing page (RTL, dark, lead form) + cost guard enforcement (50 tests green). Next: hardening + deploy files.
- [x] Stage 6 — Hardening: security fixes (webhook fail-closed + constant-time token compare, media URL allowlist), Dockerfile, Hebrew README with Railway deploy + smoke checklist, .dockerignore (50 tests green)

## Definition of Done — status

- All pytest tests green: **50 passed** ✅
- `docker build` passes: Dockerfile ready; could not be verified in the build sandbox (registry blocked by network policy) — Railway builds it on deploy ⚠
- Full user flow via `/dev/simulate` in MOCK mode (onboarding → meals → weekly): covered by tests ✅
- Admin dashboard shows users/costs/errors/scheduler/shabbat ✅
- Landing page live at `/` with lead form ✅
- README enables a 15-minute deploy ✅
- PROGRESS.md 100% ✅
