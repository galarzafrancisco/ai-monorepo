#!/bin/bash

# Self (used to construct the resource identifier)
export PROTOCOL=http
export HOST=localhost
export PORT=1111

# Auth server
export AUTHORIZATION_SERVER_BASE_URL=http://localhost:5432 

# GCP
export GCS_BUCKET_NAME=neurofabric-documents

npm run start:dev