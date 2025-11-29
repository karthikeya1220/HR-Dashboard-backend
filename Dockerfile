
# Use Node.js 20 LTS with Debian (better Prisma compatibility)
FROM node:20-slim AS base

# Install system dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
  
# Install Prisma CLI
RUN npm install -g prisma

# Set working directory
WORKDIR /app

# Copy package files and Prisma schema first for better layer caching
COPY package*.json ./
COPY prisma ./prisma

# Install all dependencies (including dev dependencies for building)
RUN npm ci && npm cache clean --force

# Copy rest of source code
COPY . .

# Remove prisma directory since it was copied twice (optimization)
# The second copy from COPY . . will overwrite anyway

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create app user (Debian syntax)
RUN groupadd -r nodejs && useradd -r -g nodejs -u 1001 nextjs

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=base --chown=nextjs:nodejs /app/dist ./dist
COPY --from=base --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nextjs:nodejs /app/package*.json ./
COPY --from=base --chown=nextjs:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p logs && chown nextjs:nodejs logs

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
