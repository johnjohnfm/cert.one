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

# Set environment variables for Puppeteer
export PUPPETEER_SKIP_DOWNLOAD=false
export PUPPETEER_CACHE_DIR="/opt/render/project/src/.cache/puppeteer"

echo "Setting up Puppeteer..."

# Force install Puppeteer browsers
echo "Installing Puppeteer browsers..."
npx puppeteer browsers install chrome || {
  echo "Failed to install Chrome via npx, trying alternative method..."
  
  # Alternative: Install via npm script
  cd node_modules/puppeteer
  node install.mjs || {
    echo "Failed to install via install.mjs, trying direct download..."
    # Force download Chromium
    PUPPETEER_SKIP_DOWNLOAD=false npm install puppeteer@latest --force
  }
  cd ../..
}

# Verify Chromium installation
echo "Verifying Chromium installation..."
if [ -d "node_modules/puppeteer/.local-chromium" ] || [ -d "node_modules/puppeteer/chromium" ]; then
  echo "✅ Chromium found in node_modules/puppeteer"
  ls -la node_modules/puppeteer/ | grep -E "(chromium|chrome)" || echo "No chromium directories found"
else
  echo "❌ Chromium not found in node_modules/puppeteer"
  echo "Contents of node_modules/puppeteer:"
  ls -la node_modules/puppeteer/ || echo "Cannot list puppeteer directory"
fi

# Check cache directory
echo "Checking Puppeteer cache directory..."
if [ -d "$PUPPETEER_CACHE_DIR" ]; then
  echo "✅ Cache directory exists: $PUPPETEER_CACHE_DIR"
  ls -la "$PUPPETEER_CACHE_DIR" || echo "Cannot list cache directory"
else
  echo "❌ Cache directory does not exist: $PUPPETEER_CACHE_DIR"
  echo "Creating cache directory..."
  mkdir -p "$PUPPETEER_CACHE_DIR" || echo "Failed to create cache directory"
fi

echo "Build completed successfully"
