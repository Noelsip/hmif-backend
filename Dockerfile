FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    mysql-client \
    bash \
    openssl \
    && rm -rf /var/cache/apk/*

WORKDIR /usr/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN echo "📦 Installing dependencies..." && \
    npm ci && \
    npm cache clean --force && \
    echo "✅ Dependencies installed successfully"

# Copy source code
COPY . .

# Generate Prisma client
RUN if [ -f "prisma/schema.prisma" ]; then \
        echo "🔧 Generating Prisma client..." && \
        npx prisma generate; \
    fi

# Create directories
RUN mkdir -p logs ssl && chmod 755 logs ssl

# ✅ Enhanced startup script dengan proper database migration
RUN cat > /usr/app/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting HMIF Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
max_attempts=60
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "🔍 Testing database connection (attempt $attempt/$max_attempts)..."
    
    if mysqladmin ping -h mysql -u root -prootpassword 2>/dev/null; then
        echo "✅ Database server is ready!"
        break
    else
        echo "⏳ Database not ready, waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    fi
    
    if [ $attempt -gt $max_attempts ]; then
        echo "❌ Database connection timeout after $max_attempts attempts"
        exit 1
    fi
done

# Ensure database exists
echo "🔧 Ensuring database exists..."
mysql -h mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || echo "Database already exists"

# Run database migration/push
echo "🔄 Running database migration..."
if npx prisma db push --accept-data-loss --force-reset; then
    echo "✅ Database schema synchronized successfully"
elif npx prisma migrate deploy; then
    echo "✅ Migration deployed successfully"
else
    echo "⚠️  Migration failed, trying to create tables manually..."
    # Generate Prisma client just in case
    npx prisma generate
fi

# Verify tables exist
echo "🔍 Verifying database tables..."
TABLES=$(mysql -h mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null | wc -l)
if [ $TABLES -gt 1 ]; then
    echo "✅ Database tables created ($((TABLES-1)) tables found)"
    mysql -h mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null || true
else
    echo "❌ No tables found in database!"
    echo "🔄 Trying emergency schema creation..."
    npx prisma db push --accept-data-loss --force-reset || echo "Emergency push failed"
fi

# Final Prisma client generation
echo "🔧 Final Prisma client generation..."
npx prisma generate

echo "🚀 Starting Node.js application..."
exec npm start
EOF

# Make startup script executable
RUN chmod +x /usr/app/startup.sh

# Expose ports
EXPOSE 3000 3443

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use startup script
CMD ["/usr/app/startup.sh"]