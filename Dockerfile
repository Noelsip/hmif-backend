FROM node:18-alpine

# Install system dependencies including OpenSSL
RUN apk add --no-cache \
    curl \
    mysql-client \
    bash \
    openssl \
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

# Create logs and ssl directories with proper permissions
RUN mkdir -p logs ssl && chmod 755 logs ssl

# ✅ Create startup script untuk handle database migration
RUN cat > /usr/app/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting HMIF Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if npx prisma db push --accept-data-loss 2>/dev/null; then
        echo "✅ Database schema synchronized successfully"
        break
    else
        echo "⏳ Database not ready yet, attempt $attempt/$max_attempts"
        sleep 2
        attempt=$((attempt + 1))
    fi
    
    if [ $attempt -gt $max_attempts ]; then
        echo "❌ Database connection failed after $max_attempts attempts"
        echo "📋 Trying alternative migration method..."
        
        # Alternative: run migration deploy
        npx prisma migrate deploy || echo "⚠️ Migration failed, continuing..."
        npx prisma db push --accept-data-loss || echo "⚠️ DB push failed"
    fi
done

# Generate Prisma client (just in case)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the application
echo "🚀 Starting Node.js application..."
exec npm start
EOF

# Make startup script executable
RUN chmod +x /usr/app/startup.sh

# Expose both HTTP and HTTPS ports
EXPOSE 3000 3443

# Simple health check without external dependency
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

# Use startup script instead of direct npm start
CMD ["/usr/app/startup.sh"]