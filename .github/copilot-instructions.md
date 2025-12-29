# Global Context

This repository aims to build an end-to-end IoT solution for "yzzx":

- `modules/` contains IoT Edge modules that run on local IoT Edge devices to collect real-time data from yzzx. Data is sent to Azure IoT Hub.
- `functions/` contains code for Azure Functions that process incoming data.
- `functions/adt-ingestor` ingests data into Azure Digital Twins.
- Cloud infrastructure is deployed via Terraform in `infra/`.

# Copilot Instructions

## Workflow

**For every AI-completed task:**
1. Apply Test-Driven Development (TDD):
  - Add a failing test first describing the expected behavior.
  - Implement the feature or fix so the test passes.
  - Ensure the test passes after implementation.
2. Before finishing:
  - Run build, lint, and test commands.
  - Fix any build, lint, or test issues until all pass successfully.

## Project Structure

- `infra/` — Terraform for Azure resources (Function App, IoT Hub, Digital Twins)
- `functions/adt-ingestor/` — TypeScript Azure Function (src, test, config, connectors, core, telemetry)
- `modules/HueAgent/` — Node.js IoT Edge module (source, tests, Dockerfiles)
- `iotedge-layers/` — IoT Edge deployment manifests
- `scripts/` — Bash scripts for deployment and automation
- `deploy.sh` — Top-level deployment script


## Commit Messages

Use Conventional Commits:
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore, ci, perf, build
- Keep subject ≤ 50 chars, imperative mood
- Use scope for module/component
- Add body/context if needed

Examples:
feat(hueagent): add arm64 support
fix(pipeline): use Dockerfile.arm64v8
ci(workflow): update Node.js version

## Versioning

Semantic-release versioning is only used for `modules/HueAgent`:
- Do not manually update `modules/HueAgent/package.json` version
- Version bumps based on commit type:
  - feat: minor
  - fix: patch
  - BREAKING CHANGE/! : major
  - perf/refactor: patch
- CHANGELOG.md, tags, and releases are auto-generated for `modules/HueAgent`
