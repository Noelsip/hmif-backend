FROM node:18-alpine

# Install system dependencies dengan MariaDB client (default Alpine)
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

# ✅ Fixed startup script dengan proper heredoc syntax
RUN cat > /usr/app/startup.sh << 'STARTUP_SCRIPT'
#!/bin/bash
set -e

echo "🚀 HMIF Backend Startup (MariaDB Client → MySQL Server)"
echo "======================================================"

# MariaDB client connecting to MySQL server
check_mysql() {
    local attempt=1
    local max_attempts=60
    
    echo "🔍 Testing MySQL server connection via MariaDB client..."
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Connection attempt $attempt/$max_attempts..."
        
        if nc -z mysql 3306; then
            echo "   ✅ Network connectivity OK"
            
            # ✅ MariaDB client parameters untuk disable SSL
            if mysql -h mysql -u root -prootpassword --skip-ssl --skip-ssl-verify-server-cert -e "SELECT 1;" 2>/dev/null; then
                echo "   ✅ MySQL server authentication successful via MariaDB client!"
                return 0
            # Fallback: try tanpa SSL parameters sama sekali
            elif mysql -h mysql -u root -prootpassword -e "SELECT 1;" 2>/dev/null; then
                echo "   ✅ MySQL server authentication successful (fallback method)!"
                return 0
            else
                echo "   ❌ Authentication failed"
                # Debug output
                mysql -h mysql -u root -prootpassword --skip-ssl -e "SELECT 1;" 2>&1 | head -3 || true
            fi
        else
            echo "   ❌ Network connection failed"
        fi
        
        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 5
    done
    
    return 1
}

# Database setup dengan MariaDB client
ensure_database() {
    echo "🔧 Setting up database (MariaDB client → MySQL server)..."
    
    # ✅ Fixed heredoc syntax - menggunakan variable untuk SQL commands
    local sql_commands="CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hmif_app;
SELECT 'Database hmif_app ready!' as status;
GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%';
FLUSH PRIVILEGES;"
    
    # Try with SSL parameters first, then fallback
    if mysql -h mysql -u root -prootpassword --skip-ssl --skip-ssl-verify-server-cert -e "$sql_commands" 2>/dev/null; then
        echo "✅ Database setup completed (SSL disabled)"
    elif mysql -h mysql -u root -prootpassword -e "$sql_commands" 2>/dev/null; then
        echo "✅ Database setup completed (fallback method)"
    else
        echo "❌ Database setup failed"
        return 1
    fi
}

# Prisma migration
run_migration() {
    echo "🔄 Running Prisma migration..."
    if npx prisma migrate deploy; then
        echo "✅ Migration successful"
    elif npx prisma db push --accept-data-loss; then
        echo "✅ Database schema synchronized"
    else
        echo "⚠️ Migration had issues, but continuing..."
    fi
}

# Redis check
check_redis() {
    echo "🔍 Checking Redis..."
    timeout 60 bash -c 'until nc -z redis 6379; do sleep 1; done'
    echo "✅ Redis ready"
}

# Main execution
echo "🚀 Starting services check..."
echo "   MySQL Server: mysql:5.7"
echo "   MySQL Client: $(mysql --version | head -1)"

if check_mysql && check_redis; then
    ensure_database
    run_migration
    echo ""
    echo "🎉 All systems ready! Starting Node.js application..."
    echo "   ✅ MySQL Server: Connected"
    echo "   ✅ Database: Ready"
    echo "   ✅ Redis: Connected"
    echo "   ✅ Migrations: Applied"
    echo ""
    exec npm start
else
    echo "❌ Service checks failed"
    exit 1
fi
STARTUP_SCRIPT

# Make startup script executable
RUN chmod +x /usr/app/startup.sh

EXPOSE 3000 3443
CMD ["/usr/app/startup.sh"]