FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install only prod deps first for layer cache
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy source
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Need dev deps for build, then drop to runtime
RUN npm install --no-audit --no-fund
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/package.json ./package.json

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/server.js"]
