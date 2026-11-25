#!/usr/bin/env bash
# Serveur de démonstration sur données fictives (PGlite neuve, aucune base Supabase) : port 3200.
# Sert aux parcours à la main et aux captures du bilan produit ; n'écrit jamais dans une vraie base.
set -euo pipefail
cd "$(dirname "$0")/../apps/web"
DIR="$(cd ../.. && pwd)/.data/demo-pglite-$(date +%s)"
export COACHOS_DEMO_AUTH=1 COACHOS_PGLITE_DIR="$DIR" COACHOS_DIST_DIR=.next-demo NEXT_TELEMETRY_DISABLED=1
export DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= MAILPIT_URL=
export RESEND_API_KEY= EMAIL_FROM= ANTHROPIC_API_KEY= VAPID_PUBLIC_KEY= VAPID_PRIVATE_KEY=
exec npx next dev --port 3200
