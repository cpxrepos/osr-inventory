# OSR Inventory – AGENTS Instructions

These guidelines help contributors troubleshoot and develop new features quickly.

## Running the app
- Serve the repository root with `./test-server.sh` (Unix) or `npx http-server`.
- Open `index.html` for normal use or `sync-test.html` for manual sync testing.

## Development guidelines
- JavaScript uses ES modules and **two-space** indentation.
- Keep functions small and well-commented; use descriptive names.
- Place new scripts in the `js/` directory and import via modules.
- Do not commit generated secrets (e.g., `env.js`); use `env.js.example` as a template.

## Testing
- Run `npm test` before committing. The script currently prints "No tests specified" but serves as a smoke test.
- For manual sync checks, open multiple browser tabs pointing at the running server and verify real-time updates.

## Pull requests
- Summarize changes and reference the commands used for testing.
- Ensure `npm test` completes without errors before submitting.
