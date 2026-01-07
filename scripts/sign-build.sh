#!/bin/bash

# Load signing environment variables if file exists
if [ -f .env.signing ]; then
  echo "Loading signing secrets from .env.signing..."
  set -a
  source .env.signing
  set +a
else
  echo "Warning: .env.signing not found"
fi

# Check if required variables are set
REQUIRED_VARS=("APPLE_CERTIFICATE" "APPLE_CERTIFICATE_PASSWORD" "APPLE_SIGNING_IDENTITY" "APPLE_TEAM_ID")
MISSING=false

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo "Error: $VAR is not set."
    MISSING=true
  fi
done

if [ "$MISSING" = true ]; then
  echo "Please start by filling directly in .env.signing file."
  exit 1
fi

echo "Starting Tauri build..."
# Run the build command
# Adjust depending on package manager (bun, npm, pnpm, yarn)
if command -v bun &> /dev/null; then
    bun run tauri build
elif command -v npm &> /dev/null; then
    npm run tauri build
else
    cargo tauri build
fi
