# CERT.ONE Backend Deployment Guide

## Important Security Notice

**⚠️ SECURITY ALERT**: The `.env` file containing sensitive API keys was accidentally committed to the repository. Please follow these steps immediately:

1. **Revoke the exposed credentials:**
   - Pinata API Key: `3a2705f9dcbe28a1e4f4` - Go to https://app.pinata.cloud/ and regenerate your API keys
   - JWT Secret was also exposed - Generate a new strong secret

2. **Remove sensitive data from Git history:**
   ```bash
   # Remove .env file from all commits
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch backend/.env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push to update remote
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Update your local `.env` file with new credentials**

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:
- `PINATA_API_KEY` and `PINATA_SECRET_KEY` - Get from https://app.pinata.cloud/
- `JWT_SECRET` - Generate a strong random string
- Other optional services as needed

### 2. Local Development

```bash
# Install dependencies (without downloading Chrome)
npm install

# Run in development mode
npm run dev
```

### 3. Deployment on Render.com

The project is configured for easy deployment on Render.com:

1. **Connect your GitHub repository** to Render.com

2. **Use the provided `render.yaml`** configuration file

3. **Add environment variables** in Render dashboard:
   - `PINATA_API_KEY` (mark as secret)
   - `PINATA_SECRET_KEY` (mark as secret)
   - `JWT_SECRET` (mark as secret)
   - Any other optional API keys

4. **Deploy** - Render will automatically:
   - Install Chrome browser for Puppeteer
   - Install Node.js dependencies
   - Start the server

### 4. Build Optimization

The build process has been optimized to:
- **Skip Puppeteer Chrome download** during npm install (controlled by `PUPPETEER_SKIP_DOWNLOAD=true`)
- **Use system Chrome** when available (via `PUPPETEER_EXECUTABLE_PATH`)
- **Install Chrome separately** on Render.com during the build phase

This prevents the 2-hour build hang issue you experienced.

### 5. Alternative Deployment Options

#### Heroku
Add the Puppeteer buildpack:
```bash
heroku buildpacks:add jontewks/puppeteer
```

#### Docker
Create a Dockerfile with Chrome dependencies:
```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["npm", "start"]
```

## Troubleshooting

### Build Hangs During Deployment
- Ensure `PUPPETEER_SKIP_DOWNLOAD=true` is set
- Check that `.puppeteerrc.cjs` is present in the root directory
- Verify the build command includes Chrome installation steps

### PDF Generation Fails
- Verify Chrome is installed: check `PUPPETEER_EXECUTABLE_PATH`
- Ensure all Chrome dependencies are installed
- Check logs for specific error messages

### Template Not Found Error
- Ensure `backend/templates/cert.hbs` exists
- Check file permissions
- Verify the build process includes all files

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Rotate API keys regularly**
3. **Use environment-specific configurations**
4. **Enable CORS restrictions** in production
5. **Implement rate limiting** for API endpoints
6. **Use HTTPS** in production
7. **Validate all inputs** to prevent injection attacks

## Support

For issues or questions:
- Check the logs in your deployment platform
- Review the error messages carefully
- Ensure all environment variables are set correctly
- Verify Chrome/Chromium is properly installed
