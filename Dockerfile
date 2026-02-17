# Multi-stage build for CollabBoard MVP
# Stage 1: Build frontend (React + Vite)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files and config
COPY client/package*.json ./client/
COPY client/tsconfig.json ./client/
COPY client/tsconfig.app.json ./client/
COPY client/tsconfig.node.json ./client/
COPY client/vite.config.ts ./client/
COPY client/index.html ./client/
COPY client/src ./client/src
COPY shared ./shared

# Install dependencies
WORKDIR /app/client
RUN npm ci

# Build the frontend
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Build backend (Express + TypeScript)
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
COPY shared ./shared

# Install dependencies
WORKDIR /app/server
RUN npm ci

# Build the backend
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy backend dependencies and built code
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/dist ./server/dist
COPY server/package*.json ./server/

# Copy shared types
COPY shared ./shared

# Copy frontend build to be served as static files
COPY --from=frontend-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Set working directory to server
WORKDIR /app/server

# Start the server (which will also serve static frontend files)
CMD ["node", "dist/index.js"]
