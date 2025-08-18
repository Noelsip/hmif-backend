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

# ✅ Enhanced startup script dengan proper MySQL credential testing
RUN cat > /usr/app/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 HMIF Backend Startup Script"
echo "=============================="

# ✅ Enhanced MySQL connection testing with credentials
check_mysql() {
    local attempt=1
    local max_attempts=60
    
    echo "⏳ Checking MySQL connection with credentials..."
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Testing MySQL connection (attempt $attempt/$max_attempts)..."
        
        # Test 1: Network connectivity
        if ! nc -z mysql 3306; then
            echo "   ❌ Cannot connect to mysql:3306 (network issue)"
            sleep 5
            attempt=$((attempt + 1))
            continue
        fi
        echo "   ✅ Network connection to mysql:3306 successful"
        
        # Test 2: MySQL authentication and basic query
        if mysql -h mysql -u root -prootpassword -e "SELECT 1;" > /dev/null 2>&1; then
            echo "   ✅ MySQL authentication successful!"
            
            # Test 3: Database access
            if mysql -h mysql -u root -prootpassword -e "SHOW DATABASES;" | grep -q "hmif_app"; then
                echo "   ✅ Database hmif_app is accessible!"
                return 0
            else
                echo "   ⚠️  Database hmif_app not found, will create..."
                return 0  # Continue anyway, we'll create it
            fi
        else
            echo "   ❌ MySQL authentication failed (credentials issue)"
            
            # Debug: Check what's wrong
            echo "   🔍 Debugging MySQL connection..."
            echo "   Database URL: $DATABASE_URL"
            mysql -h mysql -u root -prootpassword --execute="SELECT 'MySQL is ready'" 2>&1 || echo "   MySQL error details printed above"
            
            sleep 5
            attempt=$((attempt + 1))
        fi
    done
    
    echo "❌ MySQL connection failed after $max_attempts attempts"
    echo "🔍 Final debugging info:"
    echo "   DATABASE_URL: $DATABASE_URL"
    echo "   Testing direct connection..."
    nc -zv mysql 3306 || true
    return 1
}

# Function to ensure database exists
ensure_database() {
    echo "🔧 Ensuring database exists..."
    
    local attempt=1
    local max_attempts=3
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Database creation attempt $attempt/$max_attempts..."
        
        if mysql -h mysql -u root -prootpassword << 'SQL'
CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hmif_app;
SELECT 'Database hmif_app is ready' as status;
GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%';
FLUSH PRIVILEGES;
SQL
        then
            echo "✅ Database hmif_app is ready and accessible"
            return 0
        else
            echo "   ❌ Database creation failed, retrying..."
            sleep 5
            attempt=$((attempt + 1))
        fi
    done
    
    echo "❌ Failed to create/access database after $max_attempts attempts"
    return 1
}

# Function to run database migration
run_migration() {
    echo "🔄 Running database migration..."
    
    # Test DATABASE_URL directly
    echo "🔍 Testing DATABASE_URL: $DATABASE_URL"
    
    # Generate Prisma client first
    echo "   Generating Prisma client..."
    npx prisma generate
    
    # Try db push with explicit force
    echo "   Trying Prisma db push with force reset..."
    if npx prisma db push --accept-data-loss --force-reset --skip-generate; then
        echo "✅ Database schema synchronized with db push"
        return 0
    fi
    
    # If db push fails, try migrate deploy
    echo "⚠️  DB push failed, trying migrate deploy..."
    if npx prisma migrate deploy; then
        echo "✅ Migration deployed successfully"
        return 0
    fi
    
    # Last resort: try without force reset
    echo "⚠️  Migrate deploy failed, trying db push without force..."
    if npx prisma db push --skip-generate; then
        echo "✅ Database schema synchronized (partial)"
        return 0
    fi
    
    echo "⚠️  All migration attempts failed, but continuing..."
    return 0  # Don't fail startup
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
        echo "   Tables:"
        mysql -h mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null | head -10 || true
        return 0
    else
        echo "⚠️  No tables found in database (normal for first run)"
        return 0
    fi
}

# Function to test application startup
test_app_startup() {
    echo "🔍 Testing application modules..."
    
    # Test if we can load Prisma
    if node -e "const { prisma } = require('./config/prisma'); console.log('✅ Prisma client loaded');" 2>/dev/null; then
        echo "✅ Prisma client test successful"
    else
        echo "❌ Prisma client test failed"
        return 1
    fi
    
    return 0
}

# Main startup sequence
main() {
    echo "Starting main startup sequence..."
    
    # Step 1: Check MySQL connection and credentials
    if ! check_mysql; then
        echo "❌ Startup failed: MySQL connection/authentication failed"
        echo "🔍 Please check:"
        echo "   1. MySQL container is running: docker compose ps"
        echo "   2. MySQL logs: docker compose logs mysql"
        echo "   3. Database credentials in .env.docker"
        exit 1
    fi
    
    # Step 2: Ensure database exists
    if ! ensure_database; then
        echo "❌ Startup failed: Database creation failed"
        exit 1
    fi
    
    # Step 3: Test app modules
    if ! test_app_startup; then
        echo "❌ Startup failed: Application module test failed"
        exit 1
    fi
    
    # Step 4: Run migration (tidak fatal jika gagal)
    run_migration || echo "⚠️  Migration skipped, tables may be created at runtime"
    
    # Step 5: Verify tables (tidak fatal jika gagal)
    verify_tables || echo "⚠️  Table verification skipped"
    
    # Step 6: Start the application
    echo "🚀 Starting Node.js application..."
    echo "   Environment: $NODE_ENV"
    echo "   Database: $DATABASE_URL"
    echo "   Port: $PORT"
    
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
HEALTHCHECK --interval=30s --timeout=20s --start-period=360s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use startup script
CMD ["/usr/app/startup.sh"]