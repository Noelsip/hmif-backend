#!/bin/bash
set -e

echo "🚀 HMIF Backend Auto Deploy with DuckDNS"
echo "════════════════════════════════════════"

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

# Enhanced Docker cleanup
echo "🧹 Comprehensive Docker cleanup..."
docker compose down --volumes --remove-orphans 2>/dev/null || true
docker container prune -f
docker volume prune -f
docker network prune -f
docker system prune -f

# Remove specific MySQL volumes if exist
docker volume rm $(docker volume ls -q | grep -E "(mysql|hmif)") 2>/dev/null || true

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
echo "📝 Creating Docker environment with explicit database credentials..."
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

echo "✅ .env.docker created with explicit database credentials"

# Build with no cache and detailed logging
echo "🔨 Building Docker images with detailed logging..."
docker compose build --no-cache --progress=plain 2>&1 | tee build.log

# Start services step by step with enhanced monitoring
echo "🚀 Starting services with enhanced monitoring..."

# Start MySQL first and wait for it to be ready
echo "🔧 Starting MySQL service..."
docker compose up -d mysql
sleep 20

# Enhanced MySQL health monitoring
echo "🔍 Monitoring MySQL startup with detailed logging..."
for i in {1..30}; do
    echo "⏳ MySQL startup check $i/30..."
    
    # Check if container is running
    if ! docker compose ps mysql | grep -q "Up"; then
        echo "❌ MySQL container is not running!"
        echo "📋 MySQL container status:"
        docker compose ps mysql
        echo "📋 MySQL logs (last 50 lines):"
        docker compose logs mysql --tail 50
        
        if [ $i -eq 30 ]; then
            exit 1
        fi
        
        sleep 10
        continue
    fi
    
    # Check if MySQL is accepting connections
    if docker compose exec mysql mysqladmin ping -u root -prootpassword --silent 2>/dev/null; then
        echo "✅ MySQL is ready and accepting connections!"
        
        # Verify database exists
        if docker compose exec mysql mysql -u root -prootpassword -e "SHOW DATABASES LIKE 'hmif_app';" 2>/dev/null | grep -q hmif_app; then
            echo "✅ Database 'hmif_app' exists and is accessible"
            break
        else
            echo "🔧 Creating database 'hmif_app'..."
            docker compose exec mysql mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
        fi
    else
        echo "⏳ MySQL not ready yet, waiting... (attempt $i/30)"
        
        if [ $i -eq 30 ]; then
            echo "❌ MySQL failed to start after 30 attempts!"
            echo "📋 Final MySQL logs:"
            docker compose logs mysql --tail 100
            echo "📋 MySQL container inspect:"
            docker inspect hmif-mysql | grep -A 10 -B 5 "Health"
            exit 1
        fi
        
        sleep 10
    fi
done

# Start Redis
echo "🔧 Starting Redis service..."
docker compose up -d redis
sleep 10

# Verify Redis is ready
for i in {1..10}; do
    if docker compose exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        break
    else
        echo "⏳ Waiting for Redis... (attempt $i/10)"
        sleep 5
        
        if [ $i -eq 10 ]; then
            echo "❌ Redis failed to start!"
            echo "📋 Redis logs:"
            docker compose logs redis --tail 20
            exit 1
        fi
    fi
done

# Start application
echo "🔧 Starting application service..."
docker compose up -d app

# Enhanced application health monitoring
echo "🔍 Monitoring application startup..."
for i in {1..40}; do
    echo "⏳ App health check $i/40..."
    
    # Check if container is running
    if ! docker compose ps app | grep -q "Up"; then
        echo "❌ App container is not running!"
        echo "📋 App container status:"
        docker compose ps app
        echo "📋 App logs (last 30 lines):"
        docker compose logs app --tail 30
        
        if [ $i -eq 40 ]; then
            exit 1
        fi
        
        sleep 15
        continue
    fi
    
    # Check application health endpoint
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo "✅ Application health check passed!"
        break
    elif [ $i -eq 40 ]; then
        echo "❌ Application health check failed after 40 attempts!"
        echo "📋 Final app logs:"
        docker compose logs app --tail 100
        echo "📋 App container inspect:"
        docker inspect hmif-app | grep -A 5 -B 5 "Health"
        exit 1
    else
        echo "⏳ App not ready yet, waiting... (attempt $i/40)"
        sleep 15
    fi
done

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
echo "🔍 Quick verification:"
curl -s http://localhost:3000/health | head -3 || echo "Health check endpoint not responding"