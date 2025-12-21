# HueAgent

IoT Edge module for filtering and processing temperature sensor data.

## Version Management

This project uses [semantic-release](https://semantic-release.gitbook.io/) for automated version management and package publishing. Versions are automatically determined based on commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### How It Works

1. **Commit messages** determine the version bump:
   - `feat:` → minor version bump (0.1.0 → 0.2.0)
   - `fix:` → patch version bump (0.1.0 → 0.1.1)
   - `BREAKING CHANGE:` → major version bump (0.1.0 → 1.0.0)
   - `perf:`, `refactor:` → patch version bump

2. **On merge to main**:
   - semantic-release analyzes commits since last release
   - Determines version bump
   - Updates package.json
   - Generates CHANGELOG.md
   - Creates git tag
   - Creates GitHub release
   - Pipeline builds and publishes Docker images with version tags

3. **Do NOT manually update** `package.json` version - it's fully automated!

### Commit Message Format

Use the format defined in `.github/copilot-instructions.md`:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Example:
```
feat(hueagent): add support for Hue motion sensors

- Parse motion sensor events
- Update twin with motion state
- Add motion event filters
```

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
