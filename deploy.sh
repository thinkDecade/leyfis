#!/usr/bin/env bash
# deploy.sh — build and deploy both Leyfis apps to Netlify
# Usage: ./deploy.sh

set -e
cd "$(dirname "$0")"

echo "==> Building @leyfis/app..."
(cd app && yarn workspace @leyfis/app build)

echo "==> Building @leyfis/admin..."
(cd app && yarn workspace @leyfis/admin build)

echo "==> Deploying leyfis-app to Netlify..."
(cd app/apps/app && netlify deploy --dir=out --prod --no-build)

echo "==> Deploying leyfis-admin to Netlify..."
(cd app/apps/admin && netlify deploy --dir=out --prod --no-build)

echo ""
echo "✓ Both apps deployed."
echo "  app:   https://leyfis-app.netlify.app"
echo "  admin: https://leyfis-admin.netlify.app"
