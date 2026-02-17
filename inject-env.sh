#!/bin/sh

# Inject environment variables into index.html BEFORE starting the server
INDEX_FILE="/app/client/dist/index.html"

echo "Injecting environment variables into index.html..."
echo "VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY:-(not set)}"
echo "VITE_LIVEBLOCKS_PUBLIC_KEY=${VITE_LIVEBLOCKS_PUBLIC_KEY:-(not set)}"

# Create the injection script
INJECT="<script>
window.__VITE_CLERK_PUBLISHABLE_KEY='${VITE_CLERK_PUBLISHABLE_KEY}';
window.__VITE_LIVEBLOCKS_PUBLIC_KEY='${VITE_LIVEBLOCKS_PUBLIC_KEY}';
window.__VITE_API_URL='${VITE_API_URL:-/api}';
console.log('Env vars injected:', window.__VITE_CLERK_PUBLISHABLE_KEY ? 'Clerk ✓' : 'Clerk ✗', window.__VITE_LIVEBLOCKS_PUBLIC_KEY ? 'Liveblocks ✓' : 'Liveblocks ✗');
</script>"

# Use awk to insert after <head> tag
awk -v inject="$INJECT" '/<head>/{print; print inject; next} {print}' "$INDEX_FILE" > "$INDEX_FILE.tmp" && mv "$INDEX_FILE.tmp" "$INDEX_FILE"

echo "Environment variables injected."

# Start the server
exec node server/src/index.js
