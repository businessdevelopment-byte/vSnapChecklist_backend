#!/usr/bin/env bash
# Runs ON the personal server, over SSH, as part of the GitHub Actions deploy job.
# Invoked as: bash -s '<DEPLOY_PATH>' < scripts/deploy.sh (see .github/workflows/ci-cd.yml)
set -euo pipefail

DEPLOY_PATH="${1:?deploy path argument is required}"
cd "$DEPLOY_PATH"

echo "==> Fetching latest main"
git fetch origin main
git reset --hard origin/main

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Applying pending migrations"
npx prisma migrate deploy

echo "==> Building"
npm run build

echo "==> Starting/reloading via PM2"
pm2 startOrReload ecosystem.config.js --env production
pm2 save

echo "==> Deploy complete"
