# PROGRESS

- [x] Stage 1 — Skeleton: repo structure, config, DB models, logging, webhook with dedup, mocks, /dev/simulate (4 tests green). Next: LLM wrapper + onboarding.
- [x] Stage 2 — Brain: Anthropic wrapper (retry + lenient JSON), prompts.py, full onboarding, targets, commands, medical flag (13 tests green). Next: meal pipelines.
- [x] Stage 3 — Meals: vision/voice/text pipelines, 3 confidence levels, overage, emotional_flag + technique, medical support mode, commands (27 tests green). Next: proactive scheduler.
- [x] Stage 4 — Proactive: minute-tick scheduler, shabbat/holiday quiet windows, morning planning + 2h fallback, evening check-in, 24/48/96h nudges, weekly summary with TTS, daily DB backup (40 tests green). Next: admin + landing + cost guard.
- [x] Stage 5 — Admin dashboard (Basic Auth, users table, user page + weight canvas, manual send, add beta user) + landing page (RTL, dark, lead form) + cost guard enforcement (50 tests green). Next: hardening + deploy files.
- [ ] Stage 6 — Hardening: all tests, Dockerfile, README, cleanup
