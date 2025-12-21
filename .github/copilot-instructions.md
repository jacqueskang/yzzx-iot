# GitHub Copilot Instructions

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
