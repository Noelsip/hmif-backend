FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    mysql-client \
    bash \
    openssl \
    netcat-openbsd \
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

# ✅ Enhanced startup script dengan network debugging
RUN cat > /usr/app/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 HMIF Backend Startup Script"
echo "=============================="

# ✅ Network debugging function
debug_network() {
    echo "🔍 Network debugging..."
    echo "   Hostname: $(hostname)"
    echo "   Container IP: $(hostname -i)"
    
    # Test DNS resolution
    if nslookup mysql >/dev/null 2>&1; then
        MYSQL_IP=$(nslookup mysql | grep -A1 'Name:' | tail -1 | awk '{print $2}')
        echo "   MySQL container IP: $MYSQL_IP"
    else
        echo "   ❌ Cannot resolve 'mysql' hostname"
    fi
    
    # Test network connectivity
    if nc -z mysql 3306; then
        echo "   ✅ MySQL port 3306 is reachable"
    else
        echo "   ❌ MySQL port 3306 is NOT reachable"
    fi
    
    # List all running processes/connections
    echo "   Network interfaces:"
    ip addr show | grep -E "inet|eth" || true
}

# Function to check MySQL connectivity dengan better error handling
check_mysql() {
    local attempt=1
    local max_attempts=60
    
    echo "⏳ Checking MySQL connection..."
    debug_network
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Testing MySQL connection (attempt $attempt/$max_attempts)..."
        
        # Test 1: Network connectivity
        if ! nc -z mysql 3306; then
            echo "   ❌ Cannot connect to mysql:3306 (network issue)"
            sleep 3
            attempt=$((attempt + 1))
            continue
        fi
        
        # Test 2: MySQL ping
        if mysqladmin ping -h mysql -u root -prootpassword --silent 2>/dev/null; then
            echo "✅ MySQL is ready and accepting connections!"
            return 0
        else
            echo "   ⏳ MySQL responding to network but not ready for queries..."
            sleep 3
            attempt=$((attempt + 1))
        fi
    done
    
    echo "❌ MySQL connection failed after $max_attempts attempts"
    echo "🔍 Final network debug:"
    debug_network
    return 1
}

# Function to ensure database exists
ensure_database() {
    echo "🔧 Ensuring database exists..."
    
    local attempt=1
    local max_attempts=5
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Database creation attempt $attempt/$max_attempts..."
        
        if mysql -h mysql -u root -prootpassword -e "
            CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            USE hmif_app;
            SELECT 'Database hmif_app is ready' as status;
        " 2>/dev/null; then
            echo "✅ Database hmif_app is ready"
            return 0
        else
            echo "   ⏳ Database creation failed, retrying..."
            sleep 5
            attempt=$((attempt + 1))
        fi
    done
    
    echo "❌ Failed to create database after $max_attempts attempts"
    return 1
}

# Function to run database migration
run_migration() {
    echo "🔄 Running database migration..."
    
    # Generate Prisma client first
    echo "   Generating Prisma client..."
    npx prisma generate
    
    # Try db push first (for development/quick setup)
    echo "   Trying Prisma db push..."
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
    
    echo "⚠️  All migration attempts failed, but continuing..."
    return 0  # Don't fail startup if migration fails
}

# Function to verify database tables
verify_tables() {
    echo "🔍 Verifying database tables..."
    
    local table_count=$(mysql -h mysql -u root -prootpassword hmif_app -e "
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'hmif_app';
    " -s -N 2>/dev/null || echo "0")
    
    if [ "$table_count" -gt 0 ]; then
        echo "✅ Found $table_count tables in database"
        mysql -h mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null | head -10 || true
        return 0
    else
        echo "⚠️  No tables found in database (will be created by Prisma)"
        return 0  # Don't fail, let Prisma handle it
    fi
}

# Main startup sequence
main() {
    echo "Starting main startup sequence..."
    
    # Step 1: Check MySQL connection dengan timeout yang lebih lama
    if ! check_mysql; then
        echo "❌ Startup failed: MySQL connection timeout"
        echo "🔍 Final debugging information:"
        debug_network
        echo "📋 Environment variables:"
        echo "   DATABASE_URL: $DATABASE_URL"
        exit 1
    fi
    
    # Step 2: Ensure database exists
    if ! ensure_database; then
        echo "❌ Startup failed: Database creation failed"
        exit 1
    fi
    
    # Step 3: Run migration (tidak fatal jika gagal)
    run_migration || echo "⚠️  Migration skipped"
    
    # Step 4: Verify tables (tidak fatal jika gagal)
    verify_tables || echo "⚠️  Table verification skipped"
    
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

# Health check dengan timeout yang lebih panjang
HEALTHCHECK --interval=30s --timeout=15s --start-period=240s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use startup script
CMD ["/usr/app/startup.sh"]