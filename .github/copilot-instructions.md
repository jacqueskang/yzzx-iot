
# GitHub Copilot Instructions

## Repository Structure

- **infra/**: Terraform IaC for Azure (Function App, IoT Hub, Digital Twins, etc.)
- **functions/adt-ingestor/**: TypeScript Azure Function (src, test, config, connectors, core, telemetry)
- **modules/HueAgent/**: Node.js IoT Edge module (source, tests, Dockerfiles)
- **iotedge-layers/**: IoT Edge deployment manifests
- **scripts/**: Bash scripts for deployment and automation
- **deploy.sh**: Top-level deployment script

## Commit Message Format

Always use semantic commit format (Conventional Commits):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD pipeline changes
- `perf`: Performance improvements
- `build`: Build system changes

### Examples
```
feat(hueagent): add arm64 support with Node.js 24

- Create Dockerfile.arm64v8 for Raspberry Pi
- Update pipeline to build for arm64
- Add basic test file
```

```
fix(pipeline): specify Dockerfile.arm64v8 in build steps
```

```
ci(workflow): update Node.js version to 24
```


## Guidelines
- Keep subject line under 50 characters
- Use imperative mood ("add" not "added")
- Include scope when relevant (module/component name)
- Add body for context when needed
- Reference the correct folder/component in the scope (e.g., `infra`, `adt-ingestor`, `HueAgent`, `scripts`)

## Versioning

This project uses **semantic-release** for automated version management. Versions are automatically determined based on commit messages:

- **DO NOT** manually update `package.json` version
- Versions are auto-bumped when PRs merge to main
- semantic-release analyzes commit types to determine version bump:
  - `feat:` → minor version bump (0.1.0 → 0.2.0)
  - `fix:` → patch version bump (0.1.0 → 0.1.1)
  - `BREAKING CHANGE:` or `!` suffix → major version bump (0.1.0 → 1.0.0)
  - `perf:`, `refactor:` → patch version bump
- CHANGELOG.md is automatically generated
- Git tags and GitHub releases are created automatically
