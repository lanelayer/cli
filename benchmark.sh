#!/bin/sh
cd packages/sample-python
date
node ../cli/dist/cli.js prune
date
node ../cli/dist/cli.js up
date
node ../cli/dist/cli.js up --profile test
date
# Allow prod up for benchmarking purposes
LANE_ALLOW_PROD_UP=1 node ../cli/dist/cli.js up --profile prod
date
node ../cli/dist/cli.js down
date
node ../cli/dist/cli.js prune
date
