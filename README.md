# Deploying to Azure IoT Edge

This guide explains how to deploy the `deployment.template.json` manifest to your Azure IoT Hub.

## Prerequisites

1. **Azure CLI** - Install from https://docs.microsoft.com/cli/azure/install-azure-cli
2. **Azure IoT Extension** for Azure CLI
3. **Azure Subscription** with an IoT Hub instance
4. **IoT Edge Device** already registered in your IoT Hub
5. **Azure Container Registry** credentials (optional, if using private images)

## Installation

### 1. Install Azure IoT Extension

```bash
az extension add --name azure-iot
```

## Deployment Steps

### Deploy the Manifest

Deploy to a specific device:

```bash
az login

export IOTHUB_NAME="iot-jkang-sbx"
export IOTHUB_RESOURCE_GROUP="rg-jkang-iot"
export DEVICE_ID="pi4b"
DEPLOY_TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
DEPLOY_PRIORITY=$(date -u +"%s")

az iot edge deployment create \
  --deployment-id "yzzx-iot-${DEPLOY_TIMESTAMP}" \
  --hub-name $IOTHUB_NAME \
  --content "./config/deployment.arm64v8.json" \
  --target-condition "deviceId='$DEVICE_ID'" \
  --priority $DEPLOY_PRIORITY
```
