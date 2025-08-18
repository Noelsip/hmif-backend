#!/bin/bash
set -e

echo "🚀 HMIF Backend Auto Deploy with DuckDNS (MySQL Fixed)"
echo "═══════════════════════════════════════════════════════"

# Load production credentials
if [ ! -f ".env.production.local" ]; then
    echo "❌ .env.production.local tidak ditemukan!"
    exit 1
fi

source .env.production.local

# Validate DuckDNS Domain
if [ -z "$DUCKDNS_DOMAIN" ]; then
    echo "❌ DUCKDNS_DOMAIN tidak ditemukan dalam .env.production.local!"
    exit 1
fi

echo "✅ Using DuckDNS Domain: $DUCKDNS_DOMAIN"

# Create init-db.sql
echo "📝 Creating init-db.sql file..."
cat > init-db.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hmif_app;
GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%';
FLUSH PRIVILEGES;
EOF

dos2unix init-db.sql 2>/dev/null || sed -i 's/\r$//' init-db.sql
chmod 644 init-db.sql

# Enhanced Docker cleanup with force stop
echo "🧹 Comprehensive Docker cleanup..."
docker compose down --volumes --remove-orphans --timeout 30 2>/dev/null || true
docker stop $(docker ps -q) 2>/dev/null || true
docker container prune -f
docker volume prune -f
docker network prune -f
docker system prune -f

# Remove specific volumes if exist
echo "🗑️ Removing specific MySQL and Redis volumes..."
docker volume rm $(docker volume ls -q | grep -E "(mysql|hmif|redis)") 2>/dev/null || true

# Generate SSL certificates
echo "🔐 Generating SSL certificates for DuckDNS..."
mkdir -p ssl

if [ ! -f "ssl/private-key.pem" ] || [ ! -f "ssl/certificate.pem" ]; then
    openssl req -x509 -newkey rsa:2048 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -nodes \
        -subj "/C=ID/ST=East Kalimantan/L=Balikpapan/O=HMIF/CN=${DUCKDNS_DOMAIN}" \
        -addext "subjectAltName=DNS:${DUCKDNS_DOMAIN},DNS:localhost,IP:31.97.51.165" 2>/dev/null || {
        echo "⚠️ OpenSSL gagal, menggunakan fallback method..."
        
        cat > ssl/openssl.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = ID
ST = East Kalimantan
L = Balikpapan
O = HMIF
CN = ${DUCKDNS_DOMAIN}

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DUCKDNS_DOMAIN}
DNS.2 = localhost
IP.1 = 31.97.51.165
EOF
        
        openssl genrsa -out ssl/private-key.pem 2048
        openssl req -new -key ssl/private-key.pem -out ssl/cert.csr -config ssl/openssl.conf
        openssl x509 -req -in ssl/cert.csr -signkey ssl/private-key.pem -out ssl/certificate.pem -days 365 -extensions v3_req -extfile ssl/openssl.conf
        rm ssl/cert.csr ssl/openssl.conf
    }
    
    chmod 600 ssl/private-key.pem
    chmod 644 ssl/certificate.pem
    echo "✅ SSL certificates generated successfully"
else
    echo "✅ SSL certificates already exist"
fi

# Create .env.docker with explicit configurations
echo "📝 Creating Docker environment file..."
cat > .env.docker << EOF
PORT=3000
NODE_ENV=production
DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN}
VPS_IP=31.97.51.165
HOST_IP=31.97.51.165
SERVER_HOST=0.0.0.0
SSL_ENABLED=true
HTTPS_PORT=3443
SSL_PRIVATE_KEY_PATH=./ssl/private-key.pem
SSL_CERTIFICATE_PATH=./ssl/certificate.pem
EXTERNAL_URL=https://${DUCKDNS_DOMAIN}:3443
FRONTEND_URL=https://${DUCKDNS_DOMAIN}:3443
DATABASE_URL=mysql://root:rootpassword@mysql:3306/hmif_app
REDIS_URL=redis://redis:6379
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_CALLBACK_URL=https://${DUCKDNS_DOMAIN}:3443/auth/google/callback
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
REFRESH_TOKEN_EXPIRES_IN=7d
SESSION_SECRET=${SESSION_SECRET}
IMAGEKIT_PUBLIC_KEY=${IMAGEKIT_PUBLIC_KEY}
IMAGEKIT_PRIVATE_KEY=${IMAGEKIT_PRIVATE_KEY}
IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT}
ADMIN_EMAILS=${ADMIN_EMAILS}
LOG_LEVEL=info
EOF

echo "✅ .env.docker created successfully"

# Build Docker images with clean slate
echo "🔨 Building Docker images..."
docker compose build --no-cache --pull

# Start MySQL first and wait for it to be completely ready
echo "🔧 Starting MySQL service (with MySQL 5.7/8.0 compatibility fix)..."
docker compose up -d mysql

# Enhanced MySQL monitoring with better error detection
echo "🔍 Monitoring MySQL startup (enhanced monitoring)..."
mysql_ready=false
for i in {1..30}; do
    echo "⏳ MySQL startup check $i/30..."
    
    # Check if container is running
    if ! docker compose ps mysql | grep -q "Up"; then
        echo "❌ MySQL container stopped! Checking logs..."
        docker compose logs mysql --tail 20
        
        # Check for specific errors
        if docker compose logs mysql 2>&1 | grep -q "sql_mode"; then
            echo "🚨 DETECTED SQL_MODE ERROR - MySQL version compatibility issue!"
            echo "💡 Recommendation: Switch to MySQL 5.7 or fix sql_mode in docker-compose.yml"
        fi
        
        if docker compose logs mysql 2>&1 | grep -q "NO_AUTO_CREATE_USER"; then
            echo "🚨 NO_AUTO_CREATE_USER not supported in MySQL 8.0!"
            echo "💡 Please use the fixed docker-compose.yml provided above"
        fi
        
        if [ $i -eq 30 ]; then
            exit 1
        fi
        
        echo "🔄 Restarting MySQL..."
        docker compose restart mysql
        sleep 15
        continue
    fi
    
    # Test MySQL connection
    if docker compose exec mysql mysqladmin ping -u root -prootpassword --silent 2>/dev/null; then
        echo "✅ MySQL is ready and accepting connections!"
        
        # Verify database creation
        if docker compose exec mysql mysql -u root -prootpassword -e "SHOW DATABASES LIKE 'hmif_app';" 2>/dev/null | grep -q hmif_app; then
            echo "✅ Database 'hmif_app' exists and accessible"
            mysql_ready=true
            break
        else
            echo "🔧 Database 'hmif_app' not found, should be created by init script..."
        fi
    else
        echo "⏳ MySQL not ready yet, waiting... (attempt $i/30)"
        
        if [ $((i % 5)) -eq 0 ]; then
            echo "📋 MySQL logs (last 10 lines):"
            docker compose logs mysql --tail 10
        fi
        
        if [ $i -eq 30 ]; then
            echo "❌ MySQL failed to start after 30 attempts!"
            echo "📋 Complete MySQL logs:"
            docker compose logs mysql --tail 50
            echo "📋 MySQL container details:"
            docker compose ps mysql
            docker inspect hmif-mysql | grep -A 10 -B 5 "Health" || true
            exit 1
        fi
        
        sleep 10
    fi
done

if [ "$mysql_ready" = false ]; then
    echo "❌ MySQL failed to become ready!"
    exit 1
fi

# Start Redis
echo "🔧 Starting Redis service..."
docker compose up -d redis
sleep 10

# Verify Redis
echo "🔍 Verifying Redis..."
redis_ready=false
for i in {1..10}; do
    if docker compose exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        redis_ready=true
        break
    else
        echo "⏳ Waiting for Redis... (attempt $i/10)"
        
        if [ $i -eq 10 ]; then
            echo "❌ Redis failed to start!"
            echo "📋 Redis logs:"
            docker compose logs redis --tail 20
            exit 1
        fi
        
        sleep 5
    fi
done

if [ "$redis_ready" = false ]; then
    echo "❌ Redis failed to become ready!"
    exit 1
fi

# Start application
echo "🔧 Starting application service..."
docker compose up -d app

# Monitor application startup
echo "🔍 Monitoring application startup..."
app_ready=false
for i in {1..24}; do
    echo "⏳ App health check $i/24..."
    
    # Check container status
    if ! docker compose ps app | grep -q "Up"; then
        echo "❌ App container not running!"
        echo "📋 App logs (last 20 lines):"
        docker compose logs app --tail 20
        
        if [ $i -eq 24 ]; then
            exit 1
        fi
        
        sleep 15
        continue
    fi
    
    # Health endpoint check
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Application health check passed!"
        app_ready=true
        break
    elif [ $i -eq 24 ]; then
        echo "❌ Application health check failed after 24 attempts!"
        echo "📋 Complete app logs:"
        docker compose logs app --tail 100
        exit 1
    else
        echo "⏳ App not ready yet, waiting... (attempt $i/24)"
        sleep 15
    fi
done

if [ "$app_ready" = false ]; then
    echo "❌ Application failed to become ready!"
    exit 1
fi

echo ""
echo "🎉 Deploy berhasil!"
echo "════════════════════════════════════════"
echo "🌍 DuckDNS Domain: https://$DUCKDNS_DOMAIN:3443"
echo "🔓 HTTP: http://$DUCKDNS_DOMAIN:3000"  
echo "🔒 HTTPS: https://$DUCKDNS_DOMAIN:3443"
echo "🔐 OAuth: https://$DUCKDNS_DOMAIN:3443/auth/google"
echo "📚 Documentation: https://$DUCKDNS_DOMAIN:3443/docs-swagger"
echo "❤️  Health Check: https://$DUCKDNS_DOMAIN:3443/health"
echo ""
echo "📊 Final status:"
docker compose ps
echo ""
echo "🔍 Final verification:"
curl -s http://localhost:3000/health | head -3 || echo "Health check endpoint not responding"