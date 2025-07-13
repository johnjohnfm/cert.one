#!/bin/bash

echo "Starting build process..."

# Check if we're in a deployment environment
if [ -d "/opt/render" ]; then
    echo "Detected deployment environment (Render)"
    CACHE_DIR="/opt/render/project/src/.cache/puppeteer"
    PUPPETEER_CACHE_DIR="/opt/render/project/src/.cache/puppeteer"
    
    # Install Chromium dependencies for Ubuntu/Debian
    echo "Installing Chromium dependencies..."
    apt-get update -qq
    apt-get install -y -qq \
        wget \
        gnupg \
        ca-certificates \
        procps \
        libxss1 \
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
        libgtk-3-0 \
        libx11-xcb1 \
        libxcb-dri3-0 \
        libdrm2 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libatspi2.0-0 \
        libxshmfence1
    
    # Clean up
    rm -rf /var/lib/apt/lists/*
else
    echo "Detected local development environment"
    CACHE_DIR="./.cache/puppeteer"
    PUPPETEER_CACHE_DIR="./.cache/puppeteer"
fi

# Set up Puppeteer environment variables
echo "Setting up Puppeteer environment..."
export PUPPETEER_CACHE_DIR="$PUPPETEER_CACHE_DIR"
export PUPPETEER_SKIP_DOWNLOAD="false"
export PUPPETEER_DISABLE_HEADLESS_WARNING="true"

# Create cache directory
echo "Creating cache directory..."
mkdir -p "$CACHE_DIR"

# Install Puppeteer browsers with multiple fallback methods
echo "Installing Puppeteer browsers..."
CHROMIUM_INSTALLED=false

# Method 1: Try npx puppeteer browsers install
echo "Method 1: Installing via npx puppeteer browsers..."
if npx puppeteer browsers install chrome; then
    echo "✅ Chromium installed via npx puppeteer browsers"
    CHROMIUM_INSTALLED=true
else
    echo "❌ npx puppeteer browsers failed"
fi

# Method 2: Try direct Puppeteer installation
if [ "$CHROMIUM_INSTALLED" = false ]; then
    echo "Method 2: Installing via Puppeteer install script..."
    if node node_modules/puppeteer/install.mjs; then
        echo "✅ Chromium installed via install.mjs"
        CHROMIUM_INSTALLED=true
    else
        echo "❌ install.mjs failed"
    fi
fi

# Method 3: Try force reinstall
if [ "$CHROMIUM_INSTALLED" = false ]; then
    echo "Method 3: Force reinstalling Puppeteer..."
    if npm install puppeteer --force; then
        echo "✅ Puppeteer force reinstalled"
        CHROMIUM_INSTALLED=true
    else
        echo "❌ Force reinstall failed"
    fi
fi

# Method 4: Manual Chromium download (fallback)
if [ "$CHROMIUM_INSTALLED" = false ]; then
    echo "Method 4: Manual Chromium download..."
    CHROMIUM_VERSION="138.0.7204.94"
    CHROMIUM_DIR="$CACHE_DIR/chrome/linux-${CHROMIUM_VERSION}"
    
    if [ ! -d "$CHROMIUM_DIR" ]; then
        mkdir -p "$CHROMIUM_DIR"
        cd "$CHROMIUM_DIR"
        
        echo "Downloading Chromium ${CHROMIUM_VERSION}..."
        wget -q "https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${CHROMIUM_VERSION}/chrome-linux.zip"
        
        if [ -f "chrome-linux.zip" ]; then
            echo "Extracting Chromium..."
            unzip -q chrome-linux.zip
            rm chrome-linux.zip
            echo "✅ Manual Chromium download completed"
            CHROMIUM_INSTALLED=true
        else
            echo "❌ Manual download failed"
        fi
    else
        echo "✅ Chromium already exists in cache"
        CHROMIUM_INSTALLED=true
    fi
fi

# Verify Chromium installation
echo "Verifying Chromium installation..."
CHROMIUM_FOUND=false

# Check various possible locations
CHROMIUM_PATHS=(
    "node_modules/puppeteer/.local-chromium"
    "node_modules/puppeteer/.cache"
    "$CACHE_DIR/chrome"
    "$CACHE_DIR/chrome/linux-138.0.7204.94/chrome-linux"
    "node_modules/puppeteer/.local-chromium/linux-138.0.7204.94/chrome-linux"
)

for path in "${CHROMIUM_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "✅ Chromium found at: $path"
        CHROMIUM_FOUND=true
        
        # Look for the actual chrome executable
        if [ -f "$path/chrome" ]; then
            echo "✅ Chrome executable found: $path/chrome"
            echo "Chrome version: $($path/chrome --version 2>/dev/null || echo 'Version check failed')"
        fi
        
        # List contents
        echo "Contents of $path:"
        ls -la "$path" | head -10
        break
    fi
done

if [ "$CHROMIUM_FOUND" = false ]; then
    echo "❌ Chromium not found in any expected location"
    echo "Contents of node_modules/puppeteer:"
    ls -la node_modules/puppeteer/
    
    echo "Contents of cache directory:"
    if [ -d "$CACHE_DIR" ]; then
        ls -la "$CACHE_DIR"
    else
        echo "Cache directory does not exist"
    fi
fi

# Set environment variables for the application
echo "Setting final environment variables..."
export PUPPETEER_EXECUTABLE_PATH=""

# Try to find the chrome executable
for path in "${CHROMIUM_PATHS[@]}"; do
    if [ -f "$path/chrome" ]; then
        export PUPPETEER_EXECUTABLE_PATH="$(pwd)/$path/chrome"
        echo "✅ Set PUPPETEER_EXECUTABLE_PATH to: $PUPPETEER_EXECUTABLE_PATH"
        break
    fi
done

echo "Build completed successfully"
echo "Chromium installation status: $([ "$CHROMIUM_FOUND" = true ] && echo "SUCCESS" || echo "FAILED")"
