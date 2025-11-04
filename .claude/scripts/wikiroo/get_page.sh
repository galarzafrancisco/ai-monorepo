#!/bin/bash

PAGE_ID=$1

if [ -z "$PAGE_ID" ]; then
  echo "Usage: $0 <page_id>"
  exit 1
fi

curl -s "http://localhost:9999/api/v1/wikiroo/pages/$PAGE_ID" | jq .
