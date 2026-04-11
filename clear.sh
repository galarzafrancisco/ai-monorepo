#!/bin/bash

rm -rf node_modules

rm -rf apps/backend/dist
rm -rf apps/backend/node_modules
rm -rf apps/ui/dist
rm -rf apps/ui/node_modules
rm -rf apps/ui-v1/dist
rm -rf apps/ui-v1/node_modules
rm -rf apps/worker/dist
rm -rf apps/worker/node_modules
rm -rf apps/worker-v1/dist
rm -rf apps/worker-v1/node_modules

rm -rf packages/client/dist
rm -rf packages/client/node_modules
rm -rf packages/errors/dist
rm -rf packages/errors/node_modules
rm -rf packages/events/dist
rm -rf packages/events/node_modules
rm -rf packages/shared/dist
rm -rf packages/shared/node_modules
rm -rf packages/openapi-sdkgen/dist
rm -rf packages/openapi-sdkgen/node_modules
