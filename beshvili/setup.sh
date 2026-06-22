#!/usr/bin/env bash
# setup.sh — פקודה אחת שמגדירה את כל ה-Supabase backend
# הרצה: bash setup.sh

set -e
cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  echo "❌  לא נמצא קובץ .env.local"
  echo "    העתק את .env.local.example ל-.env.local ומלא את הערכים"
  exit 1
fi

# Load env vars from .env.local (skip comments and empty lines)
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)

required=("SUPABASE_PROJECT_REF" "SUPABASE_ACCESS_TOKEN" "VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY" "ANTHROPIC_API_KEY")
for v in "${required[@]}"; do
  if [ -z "${!v}" ]; then
    echo "❌  חסר: $v — מלא ב-.env.local"
    exit 1
  fi
done

echo "🔗  מחבר לפרויקט Supabase: $SUPABASE_PROJECT_REF"
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "📦  מריץ migration (יצירת טבלאות)..."
npx supabase db push

echo "🚀  פורס Edge Function: generate-booklet"
npx supabase functions deploy generate-booklet

echo "🔑  מגדיר ANTHROPIC_API_KEY כ-secret (צד שרת בלבד)"
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

echo ""
echo "✅  Setup הושלם!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  הצעד הבא: פרוס את ה-Frontend ל-Vercel"
echo ""
echo "  Option A — Vercel CLI:"
echo "    npx vercel --cwd ."
echo ""
echo "  Option B — דרך GitHub:"
echo "    1. Push repo ל-GitHub"
echo "    2. vercel.com → New Project → Import repo"
echo "    3. Root Directory: beshvili"
echo "    4. Environment Variables:"
echo "       VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "       VITE_SUPABASE_ANON_KEY=<anon key>"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
