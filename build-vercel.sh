#!/bin/bash
set -e

echo "📦 Building mono-repo for Vercel/Render..."

# Build shared package first
echo "🔧 Building @motorent/shared..."
cd packages/shared
npm run build
cd ../..

# Build frontend
echo "🎨 Building frontend..."
cd packages/frontend
npm run build
cd ../..

# Note: Backend build skipped for frontend deployment
# Backend will be built separately when deploying to Render

echo "✅ Frontend build complete!"
