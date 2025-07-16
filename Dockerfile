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
