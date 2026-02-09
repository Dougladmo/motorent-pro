#!/bin/bash
set -e

echo "📦 Building frontend for Vercel..."

# Build frontend
echo "🎨 Building frontend..."
cd frontend
npm run build
cd ..

# Note: Backend build skipped for frontend deployment
# Backend will be built separately when deploying to Render

echo "✅ Frontend build complete!"
