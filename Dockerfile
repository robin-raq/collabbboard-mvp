# Multi-stage build for CollabBoard MVP
# Stage 1: Build frontend (React + Vite)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy client and shared types
COPY client ./client
COPY shared ./shared

# Install dependencies
WORKDIR /app/client
RUN npm ci

# Build the frontend (without Clerk/Liveblocks keys - we'll inject at runtime)
RUN npm run build

# Stage 2: Build backend (Express + TypeScript)
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy server and shared directories
COPY server ./server
COPY shared ./shared

# Install dependencies and build
WORKDIR /app/server
RUN npm ci
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy frontend dist first (needed by backend to serve static files)
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy backend compiled code
COPY --from=backend-builder /app/server/dist/server ./server
COPY --from=backend-builder /app/server/node_modules ./node_modules
COPY --from=backend-builder /app/server/package*.json ./

# Create a script to inject environment variables into index.html at startup
RUN cat > /app/inject-env.sh << 'EOF'
#!/bin/sh
INDEX_FILE="/app/client/dist/index.html"

# Create the script that will be injected
ENV_SCRIPT="<script>
  window.__VITE_CLERK_PUBLISHABLE_KEY = '${VITE_CLERK_PUBLISHABLE_KEY}';
  window.__VITE_LIVEBLOCKS_PUBLIC_KEY = '${VITE_LIVEBLOCKS_PUBLIC_KEY}';
  window.__VITE_API_URL = '${VITE_API_URL:-/api}';
</script>"

# Insert the script into index.html right after <head>
sed -i "s|<head>|<head>${ENV_SCRIPT}|" "$INDEX_FILE"
EOF

RUN chmod +x /app/inject-env.sh

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Set working directory and start
WORKDIR /app
CMD ["sh", "-c", "/app/inject-env.sh && node server/src/index.js"]
