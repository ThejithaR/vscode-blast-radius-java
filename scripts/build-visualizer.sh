#!/usr/bin/env bash
# Builds the React visualizer with Vite and copies the bundle into extension/dist/webview/.
#
# Windows PowerShell:
#   npm --workspace @blast-radius/visualizer run build
#   New-Item -ItemType Directory -Force extension\dist\webview | Out-Null
#   Copy-Item visualizer\dist\* extension\dist\webview\ -Recurse -Force

set -euo pipefail

echo "==> vite build (visualizer)"
npm --workspace @blast-radius/visualizer run build

mkdir -p extension/dist/webview
cp -R visualizer/dist/* extension/dist/webview/

echo "==> Webview bundle copied to extension/dist/webview/"
