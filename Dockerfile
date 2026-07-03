FROM node:22-slim

# System dependencies for onnxruntime-node, sharp, esbuild
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 libstdc++6 libgcc-s1 libcurl4 openssl \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install workspace dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/detect-app/ ./artifacts/detect-app/

# Install pnpm 10 globally (matches workspace pnpm version)
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Delete stale lockfile to avoid pnpm format/overrides mismatch,
# then install with matching pnpm version
RUN rm -f pnpm-lock.yaml \
  && pnpm install --no-frozen-lockfile

# Build backend (esbuild → artifacts/api-server/dist/index.mjs)
RUN cd artifacts/api-server && pnpm run build

# Build frontend (Vite → artifacts/detect-app/dist/public)
RUN cd artifacts/detect-app \
  && PORT=7860 BASE_PATH=/ pnpm run build

# ONNX models (persisted by HF Spaces workspace)
COPY artifacts/api-server/models/ ./artifacts/api-server/models/

# Push DB schema (no-op if tables already exist)
RUN pnpm --filter db push || true

EXPOSE 7860

ENV PORT=7860 \
    NODE_ENV=production \
    BASE_PATH=/

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
