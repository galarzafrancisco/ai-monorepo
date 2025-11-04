#!/bin/bash

# List wiki pages showing id, title, author and timestamps
curl -s "http://localhost:9999/api/v1/wikiroo/pages" \
  | jq '.items[] | {id: .id, title: .title, author: .author, createdAt: .createdAt, updatedAt: .updatedAt}'
