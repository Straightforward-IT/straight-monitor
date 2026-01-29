#!/bin/bash

# Check if a commit message is provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide a commit message."
  echo "Usage: ./deploy.sh \"Your commit message\""
  exit 1
fi

# Run git commands
echo "🚀 Starting deployment..."
git add . && git commit -m "$1" && git push origin main && git push heroku main

echo "✅ Deployed successfully!"
