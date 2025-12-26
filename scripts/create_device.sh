#!/bin/bash
set -euo pipefail

DEVICE_ID="pi4b"  # Set your device id here
IOTHUB_NAME="iot-yzzx-iot"
az iot hub device-identity create --hub-name "$IOTHUB_NAME" --device-id "$DEVICE_ID" --edge-enabled true || true
echo "IoT Edge device '$DEVICE_ID' created (or already exists)."
DEVICE_CONNECTION_STRING=$(az iot hub device-identity connection-string show --hub-name "$IOTHUB_NAME" --device-id "$DEVICE_ID" --output tsv)
echo
cat <<EOF
To onboard your Ubuntu device as an IoT Edge device, run the following on the device:

  curl -L https://aka.ms/InstallAzureIoTEdge | sudo bash
  sudo iotedge config mp --connection-string '$DEVICE_CONNECTION_STRING'
EOF
