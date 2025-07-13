services:
  - type: web
    name: cert-one-backend
    runtime: node
    region: oregon
    plan: free
    buildCommand: |
      chmod +x build.sh
      ./build.sh
    startCommand: node backend/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: CORS_ORIGIN
        value: "*"
      - key: MAX_FILE_SIZE
        value: 52428800
      - key: DEFAULT_BLOCKCHAIN
        value: "Bitcoin (OpenTimestamps)"
      - key: OTS_API_URL
        value: https://ots.tools/api/v1
      - key: OTS_TIMEOUT
        value: 30000
      # Puppeteer configuration
      - key: PUPPETEER_SKIP_DOWNLOAD
        value: "false"
      - key: PUPPETEER_CACHE_DIR
        value: "/opt/render/project/src/.cache/puppeteer"
      - key: PUPPETEER_EXECUTABLE_PATH
        value: "/opt/render/project/src/.cache/puppeteer/chrome/linux-138.0.7204.94/chrome-linux64/chrome"
      # Add these as secret environment variables in Render dashboard:
      # - PINATA_API_KEY
      # - PINATA_SECRET_KEY
      # - JWT_SECRET
      # - WEB3_STORAGE_TOKEN (optional)
      # - GITHUB_TOKEN (optional)
