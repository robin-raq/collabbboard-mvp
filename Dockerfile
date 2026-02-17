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
RUN cat > /app/inject-env.js << 'EOF'
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'client/dist/index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Inject environment variables as window globals before the app loads
const envScript = `
<script>
  window.__VITE_CLERK_PUBLISHABLE_KEY = '${process.env.VITE_CLERK_PUBLISHABLE_KEY || ''}';
  window.__VITE_LIVEBLOCKS_PUBLIC_KEY = '${process.env.VITE_LIVEBLOCKS_PUBLIC_KEY || ''}';
  window.__VITE_API_URL = '${process.env.VITE_API_URL || '/api'}';
</script>
`;

html = html.replace('<head>', '<head>' + envScript);
fs.writeFileSync(indexPath, html);
EOF

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Set working directory and start
WORKDIR /app
CMD ["sh", "-c", "node inject-env.js && node server/src/index.js"]
