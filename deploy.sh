#!/usr/bin/env bash
set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  if [ -n "$CF_API_TOKEN" ]; then
    echo "WARNING: CF_API_TOKEN is deprecated. Using it for now, but please set CLOUDFLARE_API_TOKEN instead."
    export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
  else
    echo "ERROR: CLOUDFLARE_API_TOKEN is not set."
    echo "Set it with: export CLOUDFLARE_API_TOKEN=your-token"
    exit 1
  fi
fi

if [ -z "$WORKER_ENDPOINT_URL" ]; then
  echo "NOTE: WORKER_ENDPOINT_URL is not set in secrets.js, but deploy can still proceed."
fi

echo "Deploying Cloudflare Worker..."
wrangler deploy

echo "Deployment complete. Update secrets.js with your worker URL if needed."
