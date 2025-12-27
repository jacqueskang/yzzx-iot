#!/bin/bash
set -euo pipefail

# Deploy the TypeScript ADT Ingestor Azure Function
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_APP_NAME="func-yzzx-iot"
FUNCTION_APP_PATH="$REPO_ROOT/functions/adt-ingestor"

if [ ! -d "$FUNCTION_APP_PATH" ]; then
  echo "Error: $FUNCTION_APP_PATH does not exist."
  exit 1
fi

# Build the function app (if needed)
cd "$FUNCTION_APP_PATH"
echo "Installing dependencies for adt-ingestor..."
npm ci

echo "Building adt-ingestor..."
npm run build || true # If no build script, continue

# Publish to Azure (assumes az login and publish profile are set)
echo "Deploying adt-ingestor to Azure Function App: $FUNCTION_APP_NAME"
func azure functionapp publish "$FUNCTION_APP_NAME" --typescript --csharp

echo "Deployment of adt-ingestor complete."
