#!/bin/sh
# Generate hermesvm.framework.dSYM for Release device archives (Xcode 16+ upload check).
set -e

if [ "${CONFIGURATION}" != "Release" ]; then
  exit 0
fi

if [ "${PLATFORM_NAME}" != "iphoneos" ]; then
  exit 0
fi

DSYM_OUTPUT="${DWARF_DSYM_FOLDER_PATH}/hermesvm.framework.dSYM"
EMBEDDED_BIN="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermesvm.framework/hermesvm"

if [ ! -f "$EMBEDDED_BIN" ]; then
  EMBEDDED_BIN="${PODS_XCFRAMEWORKS_BUILD_DIR}/hermes-engine/Pre-built/hermesvm.framework/hermesvm"
fi

if [ ! -f "$EMBEDDED_BIN" ]; then
  EMBEDDED_BIN="${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm"
fi

if [ ! -f "$EMBEDDED_BIN" ]; then
  echo "warning: hermesvm binary not found; skipping dSYM generation"
  exit 0
fi

echo "Generating hermesvm dSYM from: ${EMBEDDED_BIN}"
dsymutil "${EMBEDDED_BIN}" -o "${DSYM_OUTPUT}"
echo "hermesvm dSYM written to: ${DSYM_OUTPUT}"
dwarfdump --uuid "${DSYM_OUTPUT}" 2>/dev/null || true
