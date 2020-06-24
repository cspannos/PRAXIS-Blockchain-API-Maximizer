#!/usr/bin/env bash

# --------------------------------------------------------------------
# Runs mocha tests tagged 'e2e' using an auto-mining geth dev client
# --------------------------------------------------------------------


# Exit immediately on error
set -o errexit

# Run cleanup on exit
trap cleanup EXIT

cleanup(){
  docker stop geth-client
}

echo " "
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "E2E: geth auto-mining 2s (requires docker) "
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo " "

# Launch client w/ two unlocked accounts.
# + accounts[0] default geth unlocked bal = ~infinity
# + accounts[1] unlocked, signing password = 'left-hand-of-darkness'
geth-dev-assistant --period 2 --accounts 1 --tag 'stable'

# Test
GETH_AUTOMINE=true nyc --no-clean --silent _mocha -- \
  --reporter spec \
  --grep 'E2E' \
  --timeout 15000 \
  --exit
