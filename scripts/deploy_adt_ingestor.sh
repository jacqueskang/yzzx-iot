#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."


# Hard-coded Function App name (edit as needed)
FUNCTIONAPP_NAME="func-yzzx-iot"

echo "Deploying adt-ingestor-dotnet to Azure Function App: $FUNCTIONAPP_NAME"

cd "$REPO_ROOT/functions/adt-ingestor-dotnet"
dotnet publish -c Release -o ./publish


# Clean up any previous zip
ZIP_NAME="${FUNCTIONAPP_NAME}.zip"
rm -f "$ZIP_NAME"

# Remove .azurefunctions (not needed for deployment)
echo "Removing .azurefunctions directory from publish output if present..."
rm -rf ./publish/.azurefunctions

# For Flex Consumption, zip the entire publish directory as a folder at the root of the zip
echo "Zipping the entire publish directory as required by Flex Consumption plan..."
if command -v zip >/dev/null 2>&1; then
  zip -r "$ZIP_NAME" publish
else
  echo "zip command not found. Attempting to use PowerShell Compress-Archive..."
  powershell -Command "Compress-Archive -Path ./publish -DestinationPath ./$ZIP_NAME -Force"
fi

# Hard-coded resource group name
RESOURCE_GROUP="rg-yzzx-iot"

# Deploy using Azure CLI (assumes az login and correct subscription)
if [ ! -f "$ZIP_NAME" ]; then
  echo "Error: $ZIP_NAME not found. Aborting deployment."
  exit 1
fi

echo "Deploying $ZIP_NAME to Azure Function App using config-zip..."
az functionapp deployment source config-zip \
  --name "$FUNCTIONAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --src "$ZIP_NAME"

echo "Deployment complete."
