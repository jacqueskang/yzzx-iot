#!/bin/bash
set -euo pipefail

# Azure login
if ! az account show > /dev/null 2>&1; then
  echo "Logging in to Azure..."
  az login
fi

# --- PART 1: Deploy Azure Infrastructure ---
read -p "[1/3] Deploy Azure infrastructure? (y/n): " REPLY_INFRA
if [[ "$REPLY_INFRA" =~ ^[Yy]$ ]]; then
  echo "Deploying Azure infrastructure..."
  cd "$(dirname "$0")/infra"
  terraform init -input=false
  terraform apply -auto-approve
  IOTHUB_NAME=$(terraform output -raw iothub_name)
  export IOTHUB_NAME
  echo "IoT Hub name: $IOTHUB_NAME"
  cd ..
else
  echo "Skipping Azure infrastructure deployment."
  # Try to get IOTHUB_NAME from output if not set
  if [ -z "${IOTHUB_NAME:-}" ] && [ -d infra ]; then
    IOTHUB_NAME=$(cd infra && terraform output -raw iothub_name)
    export IOTHUB_NAME
    echo "IoT Hub name: $IOTHUB_NAME (from output)"
  fi
fi

# --- PART 2: Create IoT Edge Device ---
DEVICE_ID="pi4b"  # Set your device id here
read -p "[2/3] Create IoT Edge device '$DEVICE_ID'? (y/n): " REPLY_DEVICE
if [[ "$REPLY_DEVICE" =~ ^[Yy]$ ]]; then
  echo "Creating IoT Edge device..."
  if [ -z "${IOTHUB_NAME:-}" ]; then
    echo "ERROR: IOTHUB_NAME is not set. Cannot create IoT Edge device."
    exit 1
  fi
  az iot hub device-identity create --hub-name "$IOTHUB_NAME" --device-id "$DEVICE_ID" --edge-enabled true || true
  echo "IoT Edge device '$DEVICE_ID' created (or already exists)."
  echo
  # Retrieve the device connection string
  DEVICE_CONNECTION_STRING=$(az iot hub device-identity connection-string show --hub-name "$IOTHUB_NAME" --device-id "$DEVICE_ID" --output tsv)
  echo "To onboard your Ubuntu device as an IoT Edge device, run the following on the device:"
  echo
  echo "  curl -L https://aka.ms/InstallAzureIoTEdge | sudo bash"
  echo "  sudo iotedge config mp --connection-string '$DEVICE_CONNECTION_STRING'"
  echo
else
  echo "Skipping IoT Edge device creation."
fi

# --- PART 3: Deploy IoT Edge Layer ---
DEPLOYMENT_FILE="iotedge-layers/deployment.arm64v8.json"
read -p "[3/3] Deploy IoT Edge layer to device '$DEVICE_ID' using '$DEPLOYMENT_FILE'? (y/n): " REPLY_LAYER
if [[ "$REPLY_LAYER" =~ ^[Yy]$ ]]; then
  echo "Deploying IoT Edge layer..."
  if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "ERROR: $DEPLOYMENT_FILE not found. Aborting IoT Edge deployment."
    exit 1
  fi
  if [ -z "${IOTHUB_NAME:-}" ]; then
    echo "ERROR: IOTHUB_NAME is not set. Cannot deploy IoT Edge layer."
    exit 1
  fi
  echo "Deploying IoT Edge layer using $DEPLOYMENT_FILE to $IOTHUB_NAME (device: $DEVICE_ID)..."
  az iot edge set-modules --hub-name "$IOTHUB_NAME" --device-id "$DEVICE_ID" --content "$DEPLOYMENT_FILE"
else
  echo "Skipping IoT Edge layer deployment."
fi

echo "Deployment complete."
