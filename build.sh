#!/bin/bash

echo "Starting build process..."

# Install Node dependencies first
echo "Installing Node dependencies..."
npm install --production

# Install dependencies for Chromium
echo "Installing Chromium dependencies..."
apt-get update || true
apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  fonts-liberation \
  ca-certificates \
  --no-install-recommends || true

# Clean up
rm -rf /var/lib/apt/lists/* || true

# Ensure Puppeteer downloads Chromium
echo "Setting up Puppeteer..."
cd node_modules/puppeteer

# Force download of Chromium if not present
if [ ! -d ".local-chromium" ] && [ ! -d "chromium" ]; then
  echo "Downloading Chromium for Puppeteer..."
  node install.mjs || echo "Chromium download failed, will use system Chrome"
else
  echo "Chromium already present"
fi

cd ../..

# Set environment variables for Puppeteer
export PUPPETEER_SKIP_DOWNLOAD=false
export PUPPETEER_CACHE_DIR="/opt/render/project/src/.cache/puppeteer"

echo "Build completed successfully"
