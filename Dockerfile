# --- Build Stage ---
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source and config
COPY . .

# Compile TypeScript to JavaScript
# This assumes you have a "build" script in package.json: "tsc"
RUN npm run build

# --- Runtime Stage ---
FROM node:20-slim

WORKDIR /app

# 1. Install Python3 and FFmpeg (Crucial for yt-dlp on Render)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy only production files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 3. Ensure the environment is set to production
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run the compiled JS from the dist folder
CMD ["node", "dist/server.js"]
