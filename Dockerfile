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
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create required directories
RUN mkdir -p logs ssl && chmod 755 logs ssl

# ✅ Enhanced startup script dengan better error handling
RUN cat > /usr/app/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 HMIF Backend Startup Script"
echo "=============================="

# Function to check MySQL connectivity
check_mysql() {
    local attempt=1
    local max_attempts=30
    
    echo "⏳ Checking MySQL connection..."
    while [ $attempt -le $max_attempts ]; do
        if mysqladmin ping -h mysql -u root -prootpassword --silent 2>/dev/null; then
            echo "✅ MySQL is ready (attempt $attempt)"
            return 0
        else
            echo "⏳ MySQL not ready, attempt $attempt/$max_attempts"
            sleep 3
            attempt=$((attempt + 1))
        fi
    done
    
    echo "❌ MySQL connection failed after $max_attempts attempts"
    return 1
}

# Function to ensure database exists
ensure_database() {
    echo "🔧 Ensuring database exists..."
    
    # Try to create database if it doesn't exist
    mysql -h mysql -u root -prootpassword -e "
        CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        SHOW DATABASES LIKE 'hmif_app';
    " 2>/dev/null || {
        echo "❌ Failed to create database"
        return 1
    }
    
    echo "✅ Database hmif_app is ready"
    return 0
}

# Function to run database migration
run_migration() {
    echo "🔄 Running database migration..."
    
    # Generate Prisma client first
    npx prisma generate
    
    # Try db push first (for development/quick setup)
    if npx prisma db push --accept-data-loss --skip-generate; then
        echo "✅ Database schema synchronized with db push"
        return 0
    fi
    
    # If db push fails, try migrate deploy
    echo "⚠️  DB push failed, trying migrate deploy..."
    if npx prisma migrate deploy; then
        echo "✅ Migration deployed successfully"
        return 0
    fi
    
    echo "❌ All migration attempts failed"
    return 1
}

# Function to verify database tables
verify_tables() {
    echo "🔍 Verifying database tables..."
    
    local table_count=$(mysql -h mysql -u root -prootpassword hmif_app -e "
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'hmif_app';
    " -s -N 2>/dev/null)
    
    if [ "$table_count" -gt 0 ]; then
        echo "✅ Found $table_count tables in database"
        mysql -h mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null | head -10
        return 0
    else
        echo "❌ No tables found in database"
        return 1
    fi
}

# Main startup sequence
main() {
    echo "Starting main startup sequence..."
    
    # Step 1: Check MySQL connection
    if ! check_mysql; then
        echo "❌ Startup failed: MySQL connection timeout"
        exit 1
    fi
    
    # Step 2: Ensure database exists
    if ! ensure_database; then
        echo "❌ Startup failed: Database creation failed"
        exit 1
    fi
    
    # Step 3: Run migration
    if ! run_migration; then
        echo "⚠️  Migration failed, but continuing..."
        # Don't exit here, try to start the app anyway
    fi
    
    # Step 4: Verify tables (optional)
    verify_tables || echo "⚠️  Table verification failed"
    
    # Step 5: Start the application
    echo "🚀 Starting Node.js application..."
    exec node app.js
}

# Run main function
main
EOF

# Make startup script executable
RUN chmod +x /usr/app/startup.sh

# Expose ports
EXPOSE 3000 3443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use startup script
CMD ["/usr/app/startup.sh"]