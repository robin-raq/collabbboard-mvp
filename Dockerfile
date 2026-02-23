# y-websocket server for Railway
FROM node:20-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/src ./src
COPY server/tsconfig.json ./tsconfig.json
# shared/ is imported by server code — place at /shared/ to match ../../shared/ from /app/src/
COPY shared/ /shared/

EXPOSE 1234

CMD ["npx", "tsx", "src/index.ts"]
