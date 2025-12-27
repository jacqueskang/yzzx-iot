#!/bin/bash
set -euo pipefail

# Azure login
if ! az account show > /dev/null 2>&1; then
  echo "Logging in to Azure..."
  az login
fi

# --- PART 1: Deploy Azure Infrastructure ---
read -p "[1/4] Deploy Azure infrastructure? (y/n): " REPLY_INFRA
if [[ "$REPLY_INFRA" =~ ^[Yy]$ ]]; then
  ./scripts/deploy_infra.sh
else
  echo "Skipping Azure infrastructure deployment."
fi

# --- PART 2: Deploy Function App ---
read -p "[2/4] Deploy Function App? (y/n): " REPLY_FUNCTION_APP
if [[ "$REPLY_FUNCTION_APP" =~ ^[Yy]$ ]]; then
  ./scripts/deploy_function_app.sh
else
  echo "Skipping function app deployment."
fi

# --- PART 3: Create IoT Edge Device ---
read -p "[3/4] Create IoT Edge device? (y/n): " REPLY_DEVICE
if [[ "$REPLY_DEVICE" =~ ^[Yy]$ ]]; then
  ./scripts/create_device.sh
else
  echo "Skipping IoT Edge device creation."
fi

# --- PART 4: Deploy IoT Edge Layer ---
read -p "[4/4] Deploy IoT Edge layer? (y/n): " REPLY_LAYER
if [[ "$REPLY_LAYER" =~ ^[Yy]$ ]]; then
  ./scripts/deploy_layer.sh
else
  echo "Skipping IoT Edge layer deployment."
fi

echo "Deployment complete."
