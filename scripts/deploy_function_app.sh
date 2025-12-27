#!/bin/bash
set -euo pipefail

# Hardcoded deployment parameters
RESOURCE_GROUP="rg-yzzx-iot"
FUNCTION_APP_NAME="func-yzzx-iot"

echo "[INFO] Deploying Function App: $FUNCTION_APP_NAME to Resource Group: $RESOURCE_GROUP"

PROJECT_DIR="$(cd "$(dirname "$0")/../functions/adt-ingestor" && pwd)"

echo "[INFO] Creating deployment zip..."
rm -f functionapp.zip
zip -r functionapp.zip . -x "test/*" "node_modules/*" "functionapp.zip"
popd > /dev/null

echo "[INFO] Deploying to Azure Function App with remote build..."
az functionapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FUNCTION_APP_NAME" \
  --src "functionapp.zip" \
  --build-remote true

echo "[SUCCESS] Deployment complete."
