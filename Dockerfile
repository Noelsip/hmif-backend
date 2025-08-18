FROM node:18-alpine

# Install system dependencies including MySQL client
RUN apk add --no-cache \
    bash \
    curl \
    netcat-openbsd \
    mysql-client \
    dos2unix

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

# ✅ Enhanced startup script with SSL-disabled MySQL connection
RUN cat > /usr/app/startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 HMIF Backend Startup Script (SSL Fixed)"
echo "=========================================="

# Enhanced MySQL connection testing with SSL disabled
check_mysql() {
    local attempt=1
    local max_attempts=60
    
    echo "🔍 Testing MySQL connection with SSL disabled..."
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Testing MySQL connection (attempt $attempt/$max_attempts)..."
        
        # Test network connectivity first
        if nc -z mysql 3306; then
            echo "   ✅ Network connection to mysql:3306 successful"
            
            # Test MySQL authentication with SSL disabled
            if mysql -h mysql -u root -prootpassword --ssl-mode=DISABLED -e "SELECT 1;" 2>/dev/null; then
                echo "   ✅ MySQL authentication successful (SSL disabled)!"
                return 0
            else
                echo "   ❌ MySQL authentication failed (credentials issue)"
                echo "   🔍 Debugging MySQL connection..."
                echo "   Database URL: $(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/')"
                mysql -h mysql -u root -prootpassword --ssl-mode=DISABLED -e "SELECT 1;" 2>&1 | head -3 || true
                echo "   MySQL error details printed above"
            fi
        else
            echo "   ❌ Network connection to mysql:3306 failed"
        fi
        
        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 5
    done
    
    echo "❌ MySQL connection failed after $max_attempts attempts"
    return 1
}

# Function to ensure database exists with SSL disabled
ensure_database() {
    echo "🔧 Ensuring database exists..."
    mysql -h mysql -u root -prootpassword --ssl-mode=DISABLED << SQL
CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hmif_app;
SELECT 'Database hmif_app is ready' as status;
GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%';
FLUSH PRIVILEGES;
SQL
    echo "✅ Database setup completed"
}

# Function to run database migration
run_migration() {
    echo "🔄 Running database migration..."
    if npx prisma migrate deploy; then
        echo "✅ Database migration completed successfully"
    else
        echo "⚠️ Database migration failed, but continuing..."
        echo "   This might be normal for first-time setup"
    fi
}

# Function to check Redis connection
check_redis() {
    echo "🔍 Testing Redis connection..."
    local attempt=1
    local max_attempts=30
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z redis 6379 && echo "PING" | nc redis 6379 | grep -q "PONG"; then
            echo "✅ Redis connection successful!"
            return 0
        fi
        
        echo "⏳ Waiting for Redis... (attempt $attempt/$max_attempts)"
        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 3
    done
    
    echo "❌ Redis connection failed after $max_attempts attempts"
    return 1
}

# Main startup sequence
echo "🚀 Starting HMIF Backend Application..."

# Wait for MySQL
if check_mysql; then
    ensure_database
    run_migration
else
    echo "❌ Failed to connect to MySQL. Exiting..."
    exit 1
fi

# Wait for Redis
if ! check_redis; then
    echo "❌ Failed to connect to Redis. Exiting..."
    exit 1
fi

# Start the application
echo "🎉 All dependencies ready! Starting Node.js application..."
exec npm start
EOF

# Make startup script executable
RUN chmod +x /usr/app/startup.sh

# Expose the application port
EXPOSE 3000 3443

# Use startup script as entrypoint
CMD ["/usr/app/startup.sh"]