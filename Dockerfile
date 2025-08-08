FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    mysql-client \
    bash \
    && rm -rf /var/cache/apk/*

WORKDIR /usr/app

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (production + dev) karena ada prisma di devDependencies
RUN echo "📦 Installing dependencies..." && \
    npm ci && \
    npm cache clean --force && \
    echo "✅ Dependencies installed successfully"

# Verify critical packages are installed
RUN echo "🔍 Verifying critical packages..." && \
    npm list express dotenv prisma @prisma/client || echo "⚠️ Some packages missing"

# Copy source code
COPY . .

# Generate Prisma client jika schema ada
RUN if [ -f "prisma/schema.prisma" ]; then \
        echo "🔧 Generating Prisma client..." && \
        npx prisma generate; \
    else \
        echo "ℹ️ No Prisma schema found, skipping..."; \
    fi

# Create logs directory with proper permissions
RUN mkdir -p logs && chmod 755 logs

# Expose port
EXPOSE 3000

# Simple health check without external dependency
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

# Start command
CMD ["npm", "start"]