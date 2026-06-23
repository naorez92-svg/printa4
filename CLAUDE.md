# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This repo contains two separate apps:
- `beshvili/` — the active SaaS product (React + Vite + Supabase). **All new work goes here.**
- `app_cloud.py` / `Dockerfile` — legacy Flask prototype. Do not modify.

## Development (inside `beshvili/`)

```bash
cd beshvili
npm run dev        # start Vite dev server (localhost:5173)
npm run build      # production build → dist/
```

No test runner is configured. Manual browser testing is the QA method.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 6, Tailwind 3 |
| Auth | Supabase magic-link OTP (no passwords) |
| Database | Supabase Postgres with RLS on every table |
| AI backend | Supabase Edge Function (Deno) → Anthropic API (streaming SSE) |
| Deploy | Vercel (auto-deploys from `main`); Supabase for DB + Edge Function |

## Architecture

**Auth flow:** `App.jsx` checks `supabase.auth.getSession()` → renders `Login` or `Dashboard`.

**Quota/plan:** `useProfile` hook (`src/hooks/useProfile.js`) fetches `profiles.plan` and `booklets` count. `FREE_LIMIT = 2`. Plan values: `free | pro | admin`. Pro is set manually in DB; no payment integration yet.

**Booklet generation:** Client POSTs to the Edge Function at `{SUPABASE_URL}/functions/v1/generate-booklet`. The function:
1. Verifies JWT + checks quota + rate-limits (60s per user)
2. Calls Anthropic `claude-opus-4-8` with streaming
3. Returns raw SSE — client accumulates HTML chunks then inserts into `booklets` table

**Upgrade flow:** `UpgradeModal` captures name + phone → inserts into `leads` table → opens WhatsApp (`wa.me/972509139137`). No Stripe.

## Database Schema (key tables)

```
profiles   — id, plan (free|pro|admin), full_name, role, followup_sent_at
children   — id, user_id, name, grade, worlds[], level, special_needs
booklets   — id, user_id, child_id, title, html, goal, world, level,
             difficulty_feedback (too_hard|just_right|too_easy), session_notes
feedback   — id, user_id, message
leads      — id, user_id, name, phone
```

Migrations live in `supabase/migrations/`. They are applied manually via GitHub Actions (`workflow_dispatch` on `deploy-supabase.yml`), not on every push.

## Tailwind Design Tokens

```
ink    = #20184A  (dark navy — text)
canvas = #F7F6FB  (off-white — backgrounds)
brand  = #F4A02C  (amber — primary)
magic  = #6C5CE7  (purple — accents, CTAs)
grow   = #1FB58F  (teal — success)
```

Fonts: `font-display` = Baloo 2, `font-sans` = Assistant (Hebrew), `font-mono` = Rubik.

## Security Constraints — CRITICAL

- `ANTHROPIC_API_KEY` lives **only** in `supabase secrets set`. Never in `VITE_*` env vars or any client-side code.
- The repo (`naorez92-svg/printa4`) is **public**. Never hardcode secrets.
- Quota and rate-limiting are enforced **server-side** in the Edge Function, not client-side.
- `SUPABASE_ACCESS_TOKEN` goes only to GitHub Secrets (`SUPABASE_ACCESS_TOKEN`), never committed.

## Deploying Changes

**Frontend:** push to `main` → Vercel auto-deploys.

**Edge Function:** push changes under `beshvili/supabase/functions/` to `main` → GitHub Actions auto-deploys.

**DB Migrations:** add a new file in `supabase/migrations/` → go to GitHub Actions → `Deploy Supabase` → **Run workflow** manually.

## Supabase Project

- Project ref: `gywpdzkvkdisonuzhsib`
- URL: `https://gywpdzkvkdisonuzhsib.supabase.co`
- Admin email: `naorez92@gmail.com`

## Branch Strategy

- Development branch: `claude/local-setup-question-r1i1jb`
- Production: `main`
- Push frontend/UI changes to both branches. For git conflicts with `main`, use `mcp__github__push_files` to push directly rather than rebasing.
