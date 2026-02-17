# Multi-stage build for CollabBoard MVP
# Stage 1: Build frontend (React + Vite)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_LIVEBLOCKS_PUBLIC_KEY
ARG VITE_API_URL=/api

# Copy client and shared types
COPY client ./client
COPY shared ./shared

# Install dependencies
WORKDIR /app/client
RUN npm ci

# Build the frontend with environment variables
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_LIVEBLOCKS_PUBLIC_KEY=${VITE_LIVEBLOCKS_PUBLIC_KEY}
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

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Set working directory and start
WORKDIR /app
CMD ["node", "server/src/index.js"]
