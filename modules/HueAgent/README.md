# HueAgent

IoT Edge module for filtering and processing temperature sensor data.

## Development

### Prerequisites
- Node.js 24
- Azure CLI with IoT extension: `az extension add --name azure-iot`
- Azure IoT Hub with registered device and module

### Run Locally

The easiest way to run HueAgent locally is using the `npm run local` command, which automatically fetches the module connection string from Azure:

```bash
npm install
npm run local
```

This will:
1. Check if module identity exists in IoT Hub
2. Create the module identity if it doesn't exist
3. Fetch the module connection string from IoT Hub (iot-jkang-sbx/pi4b/HueAgent)
4. Start the module connected to your IoT Hub

**Requirements:**
- Azure CLI logged in (`az login`)
- IoT extension installed (`az extension add --name azure-iot`)
- Device `pi4b` exists in IoT Hub `iot-jkang-sbx`

**Manual run with connection string:**
```bash
EdgeHubConnectionString="<module-connection-string>" npm start
```

### Docker Build

Build for arm64 (Raspberry Pi):
```bash
docker build -f Dockerfile.arm64v8 -t hueagent:latest .
```

Build debug version (with Node inspector on port 9229):
```bash
docker build -f Dockerfile.arm64v8.debug -t hueagent:debug .
```

### Testing

```bash
npm test
```

## Configuration

The module reads temperature threshold from module twin desired properties:
- `TemperatureThreshold` - Temperature threshold for filtering messages (default: 25)

## Deployment

Images are automatically built and published to GitHub Container Registry when changes are merged to main.

Version tags follow semantic versioning from `package.json`:
- `latest` - Most recent build
- `x.y.z` - Specific version (e.g., `0.0.1`)
- `x.y` - Minor version (e.g., `0.0`)
- `x` - Major version (e.g., `0`)
