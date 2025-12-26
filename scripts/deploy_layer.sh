#!/bin/bash
set -euo pipefail

DEVICE_ID="pi4b"  # Set your device id here
DEPLOYMENT_FILE="iotedge-layers/deployment.arm64v8.json"
IOTHUB_NAME="iot-yzzx-iot"
if [ ! -f "$DEPLOYMENT_FILE" ]; then
  echo "ERROR: $DEPLOYMENT_FILE not found. Aborting IoT Edge deployment."
  exit 1
fi
echo "Deploying IoT Edge layer using $DEPLOYMENT_FILE to $IOTHUB_NAME (device: $DEVICE_ID)..."
az iot edge set-modules --hub-name "$IOTHUB_NAME" --device-id "$DEVICE_ID" --content "$DEPLOYMENT_FILE"
