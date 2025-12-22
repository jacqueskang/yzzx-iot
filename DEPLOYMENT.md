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

### 1. Login to Azure

```bash
az login
```

### 2. Deploy the Manifest

Deploy to a specific device:

```bash
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

**Note:** The timestamp format is `yyyymmdd-hhMMss` and priority is set to the current Unix timestamp (seconds since epoch) to ensure each deployment has a higher priority than the previous one.

### 3. Monitor the Deployment

Check deployment status (replace with your actual deployment ID):

```bash
az iot edge deployment show \
  --hub-name $IOTHUB_NAME \
  --deployment-id "yzzx-iot-${DEPLOY_TIMESTAMP}"
```

Or list all deployments to find the latest:

```bash
export IOTHUB_NAME="iot-jkang-sbx"
az iot edge deployment list --hub-name $IOTHUB_NAME
```

Monitor module status on the device:

```bash
export IOTHUB_NAME="iot-jkang-sbx"
export DEVICE_ID="pi4b"
az iot hub module-twin show \
  --hub-name $IOTHUB_NAME \
  --device-id $DEVICE_ID \
  --module-name hueAgent
```

## Manifest Configuration

The deployment manifest includes:

- **edgeAgent** (v1.5) - IoT Edge agent for managing modules
- **edgeHub** (v1.5) - IoT Edge hub for message routing
- **hueAgent** - Your custom Hue Agent module (`ghcr.io/jacqueskang/yzzx/hueagent:latest`)

### Message Routes

- `HueAgentToIoTHub` - Routes messages from hueAgent to IoT Hub upstream

### Port Mappings

The edgeHub exposes the following ports:
- `5671/tcp` - AMQP
- `8883/tcp` - MQTT
- `443/tcp` - HTTPS

## Troubleshooting

### View Device Logs

SSH into your IoT Edge device and check logs:

```bash
# Check edgeAgent logs
docker logs edgeAgent

# Check edgeHub logs
docker logs edgeHub

# Check hueAgent logs
docker logs hueAgent
```

### Verify Module Status

```bash
# On the IoT Edge device
docker ps -a
```

### Check Device Connectivity

```bash
az iot hub device-identity show \
  --hub-name $IOTHUB_NAME \
  --device-id $DEVICE_ID
```

## Image Registry

The hueAgent module uses a GitHub Container Registry (GHCR) image:
- **Image**: `ghcr.io/jacqueskang/yzzx/hueagent:latest`

Ensure your IoT Edge device has network access to pull from GHCR.

## Additional Resources

- [Azure IoT Edge Documentation](https://docs.microsoft.com/azure/iot-edge/)
- [Azure IoT Hub Documentation](https://docs.microsoft.com/azure/iot-hub/)
- [IoT Edge Deployment Reference](https://docs.microsoft.com/azure/iot-edge/module-deployment-monitoring)
