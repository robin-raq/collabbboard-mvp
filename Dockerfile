# Multi-stage build for CollabBoard MVP
# Stage 1: Build backend (Express + TypeScript)
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy server and shared directories
COPY server ./server
COPY shared ./shared

# Install dependencies and build
WORKDIR /app/server
RUN npm ci
RUN npm run build

# Stage 2: Build frontend (React + Vite)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy client and shared types
COPY client ./client
COPY shared ./shared

# Install dependencies
WORKDIR /app/client
RUN npm ci

# Build the frontend
ENV VITE_API_URL=/api
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy backend compiled code structure: dist/server/src -> server/src
COPY --from=backend-builder /app/server/dist/server ./server
COPY --from=backend-builder /app/server/node_modules ./node_modules
COPY --from=backend-builder /app/server/package*.json ./

# Copy frontend build to match the expected path (../../client/dist from src)
COPY --from=frontend-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Set working directory and start
WORKDIR /app
CMD ["node", "server/src/index.js"]
