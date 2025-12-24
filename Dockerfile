# --- Base Image ---
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Next.js recommends libc6-compat on Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
# Install dependencies
COPY package.json package-lock.json* ./
# Prefer ci with lockfile; fallback to install if lock is missing
RUN npm ci || npm install

# --- Build ---
FROM base AS build
ENV NODE_ENV=production
# Skip strict env validation during container builds
ENV SKIP_ENV_VALIDATION=1

# Copy deps and sources
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next app (standalone output)
RUN npm run build

# --- Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Ensure Next binds on 0.0.0.0
ENV HOSTNAME=0.0.0.0

# Copy standalone server and static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
