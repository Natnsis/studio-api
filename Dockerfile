# --- Build Stage ---
FROM node:20 AS builder

WORKDIR /app

# 1. Install python3 AND the helper that links 'python' to 'python3'
RUN apt-get update && apt-get install -y python3 python-is-python3

COPY package*.json ./

# Now npm install will find the 'python' binary it's looking for
RUN npm install

COPY . .
RUN npm run build

# --- Runtime Stage ---
FROM node:20-slim

WORKDIR /app

# 2. Install Runtime dependencies (FFmpeg and Python for yt-dlp)
# We add python-is-python3 here too so yt-dlp-exec works at runtime
RUN apt-get update && apt-get install -y \
    python3 \
    python-is-python3 \
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
