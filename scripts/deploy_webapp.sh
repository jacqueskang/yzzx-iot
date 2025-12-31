#!/bin/bash
set -euo pipefail

# Deploy yzzx-frontend (webapp) to Azure Static Web Apps

cd "$(dirname "$0")/../webapp"

if ! command -v npm &> /dev/null; then
  echo "npm not found. Please install Node.js and npm."
  exit 1
fi

npm install
npm run build

if ! command -v az &> /dev/null; then
  echo "Azure CLI not found. Please install Azure CLI."
  exit 1
fi

# Deploy using Azure CLI (assumes static web app resource already exists)
# Replace <app-name> and <resource-group> as needed
APP_NAME="stapp-yzzx-iot"
RESOURCE_GROUP="rg-yzzx-iot"

az staticwebapp upload \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --source . \
  --output-location dist \
  --no-wait

echo "Webapp deployment triggered. Check Azure Portal for status."
