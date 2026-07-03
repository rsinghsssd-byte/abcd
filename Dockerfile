FROM node:22-slim

# System dependencies for onnxruntime-node, sharp, esbuild
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 libstdc++6 libgcc-s1 libcurl4 openssl \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm 10 globally (matches workspace pnpm version)
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Copy root config files first (separate steps so missing lockfile
# doesn't break Docker cache calculation)
COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY tsconfig.base.json ./tsconfig.base.json
COPY tsconfig.json ./tsconfig.json

COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/detect-app/ ./artifacts/detect-app/

# Delete any stale lockfile and install deps
RUN rm -f pnpm-lock.yaml \
  && pnpm install --no-frozen-lockfile

# Build backend (esbuild → artifacts/api-server/dist/index.mjs)
RUN cd artifacts/api-server && pnpm run build

# Build frontend (Vite → artifacts/detect-app/dist/public)
RUN cd artifacts/detect-app \
  && PORT=7860 BASE_PATH=/ pnpm run build

# ONNX models (persisted by HF Spaces workspace)
COPY artifacts/api-server/models/ ./artifacts/api-server/models/

# Push DB schema at runtime (secrets available then, not during build)
# Handled by entrypoint.sh — removed build-time push

EXPOSE 7860

ENV PORT=7860 \
    NODE_ENV=production \
    BASE_PATH=/

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
