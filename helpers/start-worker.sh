#!/bin/bash

PORT=1234                    # Port where the server will be accessible

# If you plan to use Google models via ADK, set the following environment variables.
# You can either use Vertex AI or a key.
export GOOGLE_CLOUD_PROJECT=""
export GOOGLE_CLOUD_LOCATION=""
export GOOGLE_GENAI_USE_VERTEXAI="True"

npx @taico/worker@0.2.16 --serverurl http://localhost:$PORT

