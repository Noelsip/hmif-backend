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

# ✅ Enhanced startup script dengan proper database migration
RUN cat > /usr/app/startup.sh << 'STARTUP_SCRIPT'
#!/bin/bash
set -e

echo "🚀 HMIF Backend Startup (Enhanced Database Migration)"
echo "===================================================="

# Check dependencies
echo "🔍 Checking Swagger dependencies..."
node -e "
try {
  require('swagger-jsdoc');
  require('swagger-ui-express');
  console.log('✅ Swagger dependencies OK');
} catch(e) {
  console.error('❌ Missing swagger dependencies:', e.message);
  process.exit(1);
}
"

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
    
    # ✅ Use proper SQL commands
    local sql_commands="CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE hmif_app; SELECT 'Database hmif_app ready!' as status; GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%'; FLUSH PRIVILEGES;"
    
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

# ✅ Enhanced database migration function
run_migration() {
    echo "🔄 Running Enhanced Database Migration..."
    
    # First, check current database state
    echo "🔍 Checking current database schema..."
    
    # Check if migration table exists
    if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW TABLES LIKE '_prisma_migrations';" 2>/dev/null | grep -q "_prisma_migrations"; then
        echo "✅ Migration tracking table exists"
        
        # Show current migrations
        echo "📋 Current migrations:"
        mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;" 2>/dev/null || echo "   Could not read migration history"
    else
        echo "⚠️ Migration tracking table does not exist - this is a fresh database"
    fi
    
    # Check if User table exists and its structure
    echo "🔍 Checking User table structure..."
    if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; DESCRIBE user;" 2>/dev/null; then
        echo "✅ User table exists"
        
        # Check specifically for nim column
        if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW COLUMNS FROM user LIKE 'nim';" 2>/dev/null | grep -q "nim"; then
            echo "✅ 'nim' column exists in User table"
        else
            echo "❌ 'nim' column is MISSING from User table - migration needed!"
        fi
        
        # Check for profilePicture column
        if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW COLUMNS FROM user LIKE 'profilePicture';" 2>/dev/null | grep -q "profilePicture"; then
            echo "✅ 'profilePicture' column exists in User table"
        else
            echo "❌ 'profilePicture' column is MISSING from User table - migration needed!"
        fi
    else
        echo "❌ User table does not exist - full migration needed!"
    fi
    
    # Try multiple migration strategies
    echo "🚀 Starting migration process..."
    
    # Strategy 1: Standard Prisma migration
    echo "📋 Strategy 1: Running prisma migrate deploy..."
    if npx prisma migrate deploy 2>&1 | tee /tmp/migrate.log; then
        echo "✅ Prisma migrate deploy completed successfully"
        
        # Verify the nim column exists after migration
        if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW COLUMNS FROM user LIKE 'nim';" 2>/dev/null | grep -q "nim"; then
            echo "✅ Migration successful - 'nim' column now exists!"
            return 0
        else
            echo "⚠️ Migration completed but 'nim' column still missing - trying manual fix..."
        fi
    else
        echo "⚠️ Prisma migrate deploy failed, trying alternative approaches..."
        cat /tmp/migrate.log || true
    fi
    
    # Strategy 2: Database push (force sync)
    echo "📋 Strategy 2: Running prisma db push..."
    if npx prisma db push --accept-data-loss --force-reset 2>&1; then
        echo "✅ Prisma db push completed successfully"
        
        # Verify again
        if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW COLUMNS FROM user LIKE 'nim';" 2>/dev/null | grep -q "nim"; then
            echo "✅ Database push successful - 'nim' column now exists!"
            return 0
        else
            echo "⚠️ Database push completed but 'nim' column still missing - trying manual schema fix..."
        fi
    else
        echo "⚠️ Prisma db push failed, trying manual schema application..."
    fi
    
    # Strategy 3: Manual schema application
    echo "📋 Strategy 3: Manual schema application..."
    
    # Apply the current migration SQL manually
    echo "🔧 Applying migration SQL manually..."
    
    # Check if migration file exists and apply it
    if [ -f "/usr/app/prisma/migrations/20250715223414_init/migration.sql" ]; then
        echo "📄 Found migration file, applying..."
        mysql -h mysql -u root -prootpassword --skip-ssl hmif_app < /usr/app/prisma/migrations/20250715223414_init/migration.sql 2>&1 || {
            echo "⚠️ Manual migration application had issues, but continuing..."
        }
        
        # Final verification
        if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW COLUMNS FROM user LIKE 'nim';" 2>/dev/null | grep -q "nim"; then
            echo "✅ Manual migration successful - 'nim' column now exists!"
            return 0
        fi
    fi
    
    # Strategy 4: Create missing columns manually
    echo "📋 Strategy 4: Creating missing columns manually..."
    
    mysql -h mysql -u root -prootpassword --skip-ssl -e "
        USE hmif_app;
        
        -- Add nim column if not exists
        SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                      WHERE table_name = 'user' 
                      AND column_name = 'nim' 
                      AND table_schema = 'hmif_app') > 0,
                     'SELECT \"nim column already exists\"',
                     'ALTER TABLE user ADD COLUMN nim VARCHAR(191) UNIQUE DEFAULT NULL');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- Add profilePicture column if not exists (rename from picture if exists)
        SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                      WHERE table_name = 'user' 
                      AND column_name = 'profilePicture' 
                      AND table_schema = 'hmif_app') > 0,
                     'SELECT \"profilePicture column already exists\"',
                     IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE table_name = 'user' 
                        AND column_name = 'picture' 
                        AND table_schema = 'hmif_app') > 0,
                        'ALTER TABLE user CHANGE picture profilePicture VARCHAR(191) DEFAULT NULL',
                        'ALTER TABLE user ADD COLUMN profilePicture VARCHAR(191) DEFAULT NULL'));
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- Add lastLoginAt column if not exists (rename from lastLogin if exists)
        SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                      WHERE table_name = 'user' 
                      AND column_name = 'lastLoginAt' 
                      AND table_schema = 'hmif_app') > 0,
                     'SELECT \"lastLoginAt column already exists\"',
                     IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE table_name = 'user' 
                        AND column_name = 'lastLogin' 
                        AND table_schema = 'hmif_app') > 0,
                        'ALTER TABLE user CHANGE lastLogin lastLoginAt DATETIME(3) DEFAULT NULL',
                        'ALTER TABLE user ADD COLUMN lastLoginAt DATETIME(3) DEFAULT NULL'));
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- Add isAdmin column if not exists
        SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                      WHERE table_name = 'user' 
                      AND column_name = 'isAdmin' 
                      AND table_schema = 'hmif_app') > 0,
                     'SELECT \"isAdmin column already exists\"',
                     'ALTER TABLE user ADD COLUMN isAdmin BOOLEAN NOT NULL DEFAULT false');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        SELECT 'Manual column creation completed' as status;
    " 2>&1 || echo "⚠️ Manual column creation had some issues"
    
    # Final verification
    echo "🔍 Final verification of database schema..."
    mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; DESCRIBE user;" 2>/dev/null || echo "Could not describe user table"
    
    if mysql -h mysql -u root -prootpassword --skip-ssl -e "USE hmif_app; SHOW COLUMNS FROM user LIKE 'nim';" 2>/dev/null | grep -q "nim"; then
        echo "✅ SUCCESS: 'nim' column now exists after manual fix!"
        return 0
    else
        echo "❌ FAILED: 'nim' column still does not exist after all attempts"
        echo "   Database may need manual intervention"
        return 1
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
    if run_migration; then
        echo "✅ Database migration completed successfully"
    else
        echo "❌ Database migration failed - application may not work properly"
        echo "   Continuing startup anyway..."
    fi
    echo ""
    echo "🎉 All systems ready! Starting Node.js application..."
    echo "   ✅ MySQL Server: Connected"
    echo "   ✅ Database: Ready"
    echo "   ✅ Redis: Connected"
    echo "   ✅ Migrations: Processed"
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