#!/bin/sh

# Inject environment variables into index.html
INDEX_FILE="/app/client/dist/index.html"

# Create temporary file
TEMP_FILE=$(mktemp)

# Read the HTML file and insert script after <head>
{
  while IFS= read -r line; do
    echo "$line"
    if echo "$line" | grep -q "<head>"; then
      cat << SCRIPT
<script>
window.__VITE_CLERK_PUBLISHABLE_KEY = '$(echo "$VITE_CLERK_PUBLISHABLE_KEY" | sed "s/'/\\\\'/g")';
window.__VITE_LIVEBLOCKS_PUBLIC_KEY = '$(echo "$VITE_LIVEBLOCKS_PUBLIC_KEY" | sed "s/'/\\\\'/g")';
window.__VITE_API_URL = '${VITE_API_URL:-/api}';
</script>
SCRIPT
    fi
  done
} < "$INDEX_FILE" > "$TEMP_FILE"

# Replace original file with modified version
mv "$TEMP_FILE" "$INDEX_FILE"

# Start the server
node server/src/index.js
