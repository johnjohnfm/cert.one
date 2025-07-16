# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install Chromium and all required dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Install system dependencies
RUN apk add --no-cache \
    wget \
    curl \
    gnupg \
    && rm -rf /var/cache/apk/*

# Install OpenTimestamps CLI
RUN wget -O /tmp/ots.tar.gz https://github.com/opentimestamps/opentimestamps-client/releases/download/v0.7.0/ots-v0.7.0-linux-amd64.tar.gz \
    && tar -xzf /tmp/ots.tar.gz -C /tmp \
    && mv /tmp/ots /usr/local/bin/ots \
    && chmod +x /usr/local/bin/ots \
    && rm /tmp/ots.tar.gz

# Install Node.js dependencies

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_DISABLE_HEADLESS_WARNING=true

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create cache directory for Puppeteer
RUN mkdir -p /app/.cache/puppeteer

# Verify Chromium installation
RUN echo "Chromium version:" && chromium-browser --version

# Verify the server file exists
RUN ls -la backend/ && echo "Server file exists: $(ls -la backend/server.js)"



# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start the application with debugging
CMD ["node", "backend/server.js"] 
