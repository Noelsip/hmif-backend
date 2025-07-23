FROM node:18-alpine

# Install required tools
RUN apk add --no-cache \
    curl \
    mysql-client \
    bash

WORKDIR /usr/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN npx prisma generate

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=3 \
    CMD node healthcheck.js

# Start command (akan dioverride oleh docker-compose)
CMD ["npm", "start"]