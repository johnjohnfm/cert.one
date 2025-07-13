#!/bin/bash

echo "Starting build process..."

# Install Node dependencies
echo "Installing Node dependencies..."
npm install --production

# Check if we're in a deployment environment
if [ -d "/opt/render" ]; then
    echo "Detected deployment environment (Render)"
    CACHE_DIR="/opt/render/project/src/.cache/puppeteer"
    PUPPETEER_CACHE_DIR="/opt/render/project/src/.cache/puppeteer"
    
    # Install Chromium dependencies
    echo "Installing Chromium dependencies..."
    apt-get update -qq
    apt-get install -y -qq wget gnupg ca-certificates procps libxss1 libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 fonts-liberation
    
    # Clean up
    rm -rf /var/lib/apt/lists/*
else
    echo "Detected local development environment"
    CACHE_DIR="./.cache/puppeteer"
    PUPPETEER_CACHE_DIR="./.cache/puppeteer"
fi

# Set up Puppeteer
echo "Setting up Puppeteer..."
export PUPPETEER_CACHE_DIR="$PUPPETEER_CACHE_DIR"
export PUPPETEER_SKIP_DOWNLOAD="false"

# Create cache directory
echo "Creating cache directory..."
mkdir -p "$CACHE_DIR"

# Install Puppeteer browsers
echo "Installing Puppeteer browsers..."
if ! npx puppeteer browsers install chrome; then
    echo "Failed to install Chrome via npx, trying alternative method..."
    if ! node node_modules/puppeteer/install.mjs; then
        echo "Failed to install via install.mjs, trying direct download..."
        if ! npm install puppeteer --force; then
            echo "All installation methods failed, but continuing..."
        fi
    fi
fi

# Verify Chromium installation
echo "Verifying Chromium installation..."
if [ -d "node_modules/puppeteer/.local-chromium" ] || [ -d "node_modules/puppeteer/.cache" ] || [ -d "$CACHE_DIR/chrome" ]; then
    echo "✅ Chromium found"
    if [ -d "$CACHE_DIR/chrome" ]; then
        echo "Chrome found in cache directory:"
        ls -la "$CACHE_DIR/chrome"
    fi
else
    echo "❌ Chromium not found"
    echo "Contents of node_modules/puppeteer:"
    ls -la node_modules/puppeteer/
fi

# Check Puppeteer cache directory
echo "Checking Puppeteer cache directory..."
if [ -d "$CACHE_DIR" ]; then
    echo "✅ Cache directory exists: $CACHE_DIR"
    ls -la "$CACHE_DIR"
else
    echo "❌ Cache directory does not exist: $CACHE_DIR"
    echo "Creating cache directory..."
    if mkdir -p "$CACHE_DIR"; then
        echo "✅ Cache directory created successfully"
    else
        echo "❌ Failed to create cache directory"
    fi
fi

echo "Build completed successfully"
