# --- Build Stage ---
# Use the full node image for building; it includes build-essential tools
FROM node:20 AS builder

WORKDIR /app

# 1. Install Python here too, just in case a dependency needs it during install
RUN apt-get update && apt-get install -y python3

COPY package*.json ./

# Try a clean install. If you have peer dependency issues, 
# add --legacy-peer-deps to the command below
RUN npm install

COPY . .
RUN npm run build

# --- Runtime Stage ---
FROM node:20-slim

WORKDIR /app

# 2. Install Runtime dependencies (FFmpeg and Python for yt-dlp)
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 3. Copy files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
