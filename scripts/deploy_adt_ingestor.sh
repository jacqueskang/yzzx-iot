#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."

# Hard-coded Function App name
FUNCTIONAPP_NAME="func-yzzx-iot"

echo "Deploying adt-ingestor-dotnet to Azure Function App: $FUNCTIONAPP_NAME"

cd "$REPO_ROOT/functions/adt-ingestor-dotnet"
dotnet publish -c Release -o ./publish

# Deploy using Azure CLI (assumes az login and correct subscription)
az functionapp deployment source config-zip \
  --name "$FUNCTIONAPP_NAME" \
  --resource-group "$(jq -r .resource_group_name $REPO_ROOT/infra/terraform.tfvars.json 2>/dev/null || echo <your-resource-group>)" \
  --src ./publish.zip

# Zip the publish output
cd ./publish
zip -r ../publish.zip .
cd ..
