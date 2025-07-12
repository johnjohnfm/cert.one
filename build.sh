#!/bin/bash

# Install Node dependencies first
npm install --production

# Install dependencies for Chromium
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
  --no-install-recommends || true

# Clean up
rm -rf /var/lib/apt/lists/* || true

# Ensure Puppeteer downloads Chromium
cd node_modules/puppeteer
node install.mjs || true
cd ../..
