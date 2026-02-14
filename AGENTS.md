# Agent Instructions for fakeit

## Repository Overview

`fakeit` is a CLI utility that generates fake/mock data in JSON, YAML, CSON, or CSV formats based on model definitions written in YAML. It supports output to the console, local files, zip archives, Couchbase, and Sync Gateway.

- **Application source**: `./app/`
- **Tests**: `./test/`
- **Build output**: `./dist/` (generated, do not edit)
- **Dependencies**: `./node_modules/` (generated, do not edit)

## Ignore

Always ignore `./dist` and `./node_modules` when reading, searching, or analyzing code.

## Build

The app is written with ES module syntax and transpiled via Babel before use:

```sh
npm run build
```

This runs `babel app --out-dir dist`. The `dist/` folder is the compiled output consumed at runtime (`"main": "dist/index.js"`).

## Linting

```sh
npm run lint
```

ESLint is configured in `eslint.config.mjs`. It lints `app/` and `test/` (`.js`, `.mjs`, `.cjs`). The `dist/` folder is ignored by ESLint.

## Testing

```sh
npm test
```

Test files live in `./test/` and follow the naming pattern `*.test.js`. Supporting utilities are in `test/utils.js` and `test/console.js` (not test files themselves).

Jest is configured in `jest.config.js` with `clearMocks: true`.

## Code Conventions

- **ES modules**: All source files use `import`/`export` syntax (transpiled by Babel targeting Node 20).
- **Classes**: Core components are classes extending `Base` (`app/base.js`). Follow this pattern when adding new output types or major features.
- **Async**: Async operations use `async`/`await` throughout.
- **Test imports**: Tests explicitly import from `@jest/globals` (`describe`, `expect`, `test`, `beforeAll`, etc.) rather than relying on globals.
- **Test fixtures**: Model fixtures are in `test/fixtures/models/`. Each fixture set has a `models/` subfolder (YAML definitions) and a `validation/` subfolder (`.data.js` and `.model.js` files for assertions).
- **Path joining**: Tests use `path.join` aliased as `p` for constructing fixture paths.

## Project Structure

| Path | Purpose |
|------|---------|
| `app/index.js` | `Fakeit` main class (entry point) |
| `app/models.js` | Model parsing and dependency resolution |
| `app/documents.js` | Document generation |
| `app/documents-stream.js` | Stream-based document generation |
| `app/output/` | Output adapters (console, folder, zip, couchbase, sync-gateway) |
| `app/base.js` | Base class with shared options/logging |
| `app/cli.js` | CLI interface (commander) |
| `app/utils.js` | Shared utility functions |
| `app/logger.js` | Logging utilities |
| `test/fixtures/` | Test fixtures (model YAMLs and validation data) |

## Adding a New Output Adapter

1. Create `app/output/<name>.js` extending the pattern in existing adapters.
2. Register it in `app/output/index.js`.
3. Add a corresponding test file at `test/output/<name>.test.js`.

## Pull Request Guidelines

**Title**: `<Short description> (DO-1234)` (under 75 chars, always end with a JIRA ticket number)

**Body**:
```
Motivation:
-----
<Why this change is needed>

Modifications:
-----
- <Notable changes — don't explain obvious code>

Results (optional):
-----
<Only include when results aren't obvious, e.g. performance improvements or new workflows>
```
