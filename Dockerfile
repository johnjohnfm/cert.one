# ---- Base image ----
FROM node:18-alpine

# ---- Build arguments (for cache busting/versioning) ----
ARG BUILD_DATE
ARG VERSION

# ---- Install system dependencies for Puppeteer/Chromium ----
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    wget \
    curl \
    gnupg \
    qpdf

# ---- Puppeteer/Chromium environment variables ----
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_DISABLE_HEADLESS_WARNING=true

# ---- Set working directory ----
WORKDIR /app

# ---- Copy package files and install only production dependencies ----
COPY package*.json ./
RUN npm ci --only=production

# ---- Copy application code ----
COPY . .

# ---- Create Puppeteer cache directory ----
RUN mkdir -p /app/.cache/puppeteer

# ---- Verify Chromium installation ----
RUN echo "Chromium version:" && chromium-browser --version

# ---- Verify qpdf installation and syntax ----
RUN echo "qpdf version:" && qpdf --version && echo "qpdf help:" && qpdf --help=usage | head -20

# ---- Verify backend/server.js exists ----
RUN ls -la backend/ && echo "Server file exists: $(ls -la backend/server.js)"

# ---- Create non-root user for security ----
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# ---- Switch to non-root user ----
USER nodejs

# ---- Expose port ----
EXPOSE 3000

# ---- Start the application ----
CMD ["node", "backend/server.js"]
