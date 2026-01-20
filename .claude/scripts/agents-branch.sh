#!/bin/bash

git fetch origin --prune       

# make sure main is up to date
git checkout main
git pull --ff-only

# delete the branch locally (if it exists)
git branch -D agents/main 2>/dev/null || true

# delete it remotely (optional but recommended)
git push origin :agents/main || true

# recreate it from main
git checkout -b agents/main main

# push the fresh branch
git push -u origin agents/main