#!/usr/bin/env bash

# -------------------------------------------------------------------------------------
# Runs mocha tests tagged 'e2e' vs chrome headless + insta-mining ganache client
# -------------------------------------------------------------------------------------

# Exit immediately on error
set -o errexit

# Run cleanup on exit
trap cleanup EXIT

cleanup() {
  if [ -n "$client" ]; then
    kill -9 $client
  fi
}

echo " "
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "E2E: chrome headless browser             "
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo " "

# Launch ganache, track its PID and wait until port is open
npx ganache-cli --noVMErrorsOnRPCResponse > /dev/null &
client=$!
npx wait-port 8545

# Test
karma start \
  --single-run \
  --browsers ChromeHeadless
