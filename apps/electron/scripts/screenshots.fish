#!/usr/bin/env fish
# Screenshot script for SQL Pro
# Captures screenshots of different app states for documentation

set -l SCRIPT_DIR (dirname (status --current-filename))
set -l PROJECT_DIR (dirname $SCRIPT_DIR)
set -l SCREENSHOTS_DIR "$PROJECT_DIR/screenshots"

# Create screenshots directory
mkdir -p $SCREENSHOTS_DIR

echo "📸 SQL Pro Screenshot Capture"
echo "=============================="
echo ""

# Build the app first
echo "🔨 Building app..."
cd $PROJECT_DIR
pnpm build
if test $status -ne 0
    echo "❌ Build failed"
    exit 1
end

echo ""
echo "📷 Starting screenshot capture..."
echo ""

# Run the screenshot script
cd $PROJECT_DIR
npx tsx scripts/capture-screenshots.ts

echo ""
echo "✅ Screenshots saved to: $SCREENSHOTS_DIR"
echo ""
ls -la $SCREENSHOTS_DIR
