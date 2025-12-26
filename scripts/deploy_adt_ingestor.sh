echo "Deploying adt-ingestor to Azure Function App: $FUNCTIONAPP_NAME"

#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."


# Hard-coded Function App name
FUNCTIONAPP_NAME="func-yzzx-iot"

echo "Deploying adt-ingestor to Azure Function App: $FUNCTIONAPP_NAME"

# Check if func is available
if ! command -v func >/dev/null 2>&1; then
  echo "ERROR: Azure Functions Core Tools (func) is not installed or not in PATH."
  echo "Install with: npm i -g azure-functions-core-tools@4 --unsafe-perm true"
  exit 1
fi

cd "$REPO_ROOT/functions/adt-ingestor"
echo "Using remote build (Oryx) for x64 compatibility and smaller upload."
func azure functionapp publish "$FUNCTIONAPP_NAME" --typescript --build remote
