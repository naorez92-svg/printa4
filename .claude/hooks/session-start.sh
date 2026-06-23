#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote environment)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install beshvili (React/Vite) dependencies
if [ -f "beshvili/package.json" ]; then
  echo "Installing beshvili npm dependencies..."
  cd beshvili && npm install && cd ..
fi

# Install legacy Flask dependencies
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies..."
  pip install -q -r requirements.txt
fi

echo "Session setup complete."
