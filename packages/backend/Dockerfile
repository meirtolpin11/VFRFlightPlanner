# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci --workspace=@flight-planner/shared --workspace=@flight-planner/backend
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
RUN npm run build -w @flight-planner/shared
RUN npm run build -w @flight-planner/backend
# Copy SQL migration files (tsc doesn't copy non-ts files)
RUN cp -r /app/packages/backend/src/db/migrations /app/packages/backend/dist/db/migrations

# Production stage
FROM node:20-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
# Reproduce minimal workspace structure for npm to resolve @flight-planner/shared
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
RUN npm ci --workspace=@flight-planner/backend --omit=dev
USER appuser
WORKDIR /app/packages/backend
EXPOSE 3001
CMD ["node", "dist/index.js"]
