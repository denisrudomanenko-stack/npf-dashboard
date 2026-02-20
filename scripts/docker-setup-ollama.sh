#!/bin/bash

# Setup Ollama models in Docker container
# Run this after starting the containers

set -e

echo "🤖 Setting up Ollama models..."

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama container to be ready..."
until docker-compose exec ollama ollama list &>/dev/null; do
    sleep 2
done

echo "📥 Pulling required models..."

# Pull embedding model
echo "   Pulling nomic-embed-text..."
docker-compose exec ollama ollama pull nomic-embed-text

# Pull chat model
echo "   Pulling qwen2.5:7b..."
docker-compose exec ollama ollama pull qwen2.5:7b

echo ""
echo "✅ Ollama models installed successfully!"
echo ""
echo "📋 Available models:"
docker-compose exec ollama ollama list
