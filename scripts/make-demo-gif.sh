#!/usr/bin/env bash
set -euo pipefail

# Creates a side-by-side GIF from the demo recording screenshots
# Requires: ffmpeg (brew install ffmpeg)
#
# Usage: ./scripts/make-demo-gif.sh

DIR="apps/frontend/test-results/demo-recording"

if [ ! -d "$DIR" ]; then
  echo "No demo recording found. Run the demo recording first:"
  echo "  cd apps/frontend && npx playwright test e2e/record-demo.spec.ts"
  exit 1
fi

echo "Creating side-by-side demo GIF..."

# If ffmpeg is available, stitch videos side by side
if command -v ffmpeg &> /dev/null; then
  STAFF_VIDEO=$(ls "$DIR"/*-staff-*.webm 2>/dev/null | head -1 || true)
  GUEST_VIDEO=$(ls "$DIR"/*-guest-*.webm 2>/dev/null | head -1 || true)

  # If we have both videos, create side-by-side
  if [ -n "$STAFF_VIDEO" ] && [ -n "$GUEST_VIDEO" ]; then
    echo "Stitching videos side by side..."
    ffmpeg -y -i "$GUEST_VIDEO" -i "$STAFF_VIDEO" \
      -filter_complex "[0:v]scale=640:400[left];[1:v]scale=640:400[right];[left][right]hstack=inputs=2" \
      -t 30 "$DIR/demo-side-by-side.mp4" 2>/dev/null

    # Convert to GIF
    echo "Converting to GIF..."
    ffmpeg -y -i "$DIR/demo-side-by-side.mp4" \
      -vf "fps=10,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
      -loop 0 "$DIR/demo.gif" 2>/dev/null

    echo "✅ GIF saved to $DIR/demo.gif"
    echo "✅ Video saved to $DIR/demo-side-by-side.mp4"
  else
    echo "Video files not found. Creating GIF from screenshots instead..."
    create_gif_from_screenshots
  fi
else
  echo "ffmpeg not found. Install with: brew install ffmpeg"
  echo "Screenshots are available at: $DIR/"
  ls "$DIR"/*.png 2>/dev/null
fi
