#!/bin/bash
set -e

echo "🚀 HMIF Backend Auto Deploy with DuckDNS (SSL Fixed)"
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

# Create init-db.sql with proper permissions
echo "📝 Creating init-db.sql file..."
cat > init-db.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'rootpassword';
GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
USE hmif_app;
EOF

dos2unix init-db.sql 2>/dev/null || sed -i 's/\r$//' init-db.sql
chmod 644 init-db.sql

# Complete Docker cleanup
echo "🧹 Complete Docker cleanup..."
docker compose down --volumes --remove-orphans --timeout 30 2>/dev/null || true
docker stop $(docker ps -q) 2>/dev/null || true
docker container prune -f
docker volume prune -f
docker network prune -f
docker system prune -f

# Remove ALL Docker volumes to ensure clean state
echo "🗑️ Removing ALL Docker volumes for clean slate..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true

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

# Force clean migration by removing volumes completely
echo "🗑️ Force clean database state for proper migration..."
docker compose down --volumes --remove-orphans --timeout 30 2>/dev/null || true
docker volume rm $(docker volume ls -q | grep -E "(mysql_data|redis_data)") 2>/dev/null || true

# Create .env.docker with SSL-disabled MySQL connection
echo "📝 Creating Docker environment with SSL-disabled MySQL connection..."
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
DATABASE_URL=mysql://root:rootpassword@mysql:3306/hmif_app?sslmode=disable&ssl=false&allowPublicKeyRetrieval=true
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

echo "✅ .env.docker created with SSL-disabled MySQL connection"

# Build Docker images
echo "🔨 Building Docker images..."
docker compose build --no-cache --pull


echo "🔧 Ensuring vm.overcommit_memory=1 on host (required by Redis)"
if sysctl -n vm.overcommit_memory 2>/dev/null | grep -q '^1$'; then
  echo "✅ vm.overcommit_memory already = 1"
else
  echo "🔐 Setting vm.overcommit_memory=1 (requires sudo)"
  sudo sysctl -w vm.overcommit_memory=1 || echo "⚠️ sudo sysctl failed — run 'sudo sysctl -w vm.overcommit_memory=1' on the host"
  # persist across reboot if possible
  if [ -w /etc/sysctl.conf ]; then
    grep -q '^vm.overcommit_memory' /etc/sysctl.conf 2>/dev/null && sudo sed -i 's/^vm.overcommit_memory.*/vm.overcommit_memory = 1/' /etc/sysctl.conf || echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf >/dev/null
    echo "✅ Persisted vm.overcommit_memory in /etc/sysctl.conf"
  else
    echo "⚠️ Cannot persist to /etc/sysctl.conf automatically (permission denied)"
  fi
fi
# Start MySQL first with enhanced monitoring
echo "🔧 Starting MySQL service with SSL disabled..."
docker compose up -d mysql

# Wait for MySQL to be completely ready
echo "🔍 Enhanced MySQL monitoring with SSL fix verification..."
mysql_ready=false
for i in {1..40}; do
    echo "⏳ MySQL startup check $i/40..."
    
    # Check if container is running
    if ! docker compose ps mysql | grep -q "Up"; then
        echo "❌ MySQL container stopped!"
        echo "📋 MySQL logs:"
        docker compose logs mysql --tail 20
        
        if [ $i -eq 40 ]; then
            exit 1
        fi
        
        echo "🔄 Restarting MySQL..."
        docker compose restart mysql
        sleep 15
        continue
    fi
    
    # Test MySQL connection with SSL disabled
    echo "   Testing MySQL connection (SSL disabled)..."
    if docker compose exec mysql mysql -u root -prootpassword -e "SELECT 1" 2>/dev/null | grep -q "1"; then
        echo "✅ MySQL connection successful (SSL disabled)!"
        
        # Verify database exists
        if docker compose exec mysql mysql -u root -prootpassword -e "SHOW DATABASES LIKE 'hmif_app';" 2>/dev/null | grep -q hmif_app; then
            echo "✅ Database 'hmif_app' exists and accessible"
            mysql_ready=true
            break
        else
            echo "🔧 Creating database 'hmif_app'..."
            docker compose exec mysql mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || echo "   Database creation attempted"
        fi
    else
        echo "⏳ MySQL not ready yet... (attempt $i/40)"
        
        if [ $((i % 10)) -eq 0 ]; then
            echo "📋 MySQL connection debugging:"
            echo "   Testing network connectivity..."
            docker compose exec mysql netstat -ln | grep 3306 || echo "   Port 3306 not listening"
            echo "   Testing local MySQL connection..."
            docker compose exec mysql mysql -u root -prootpassword -e "SELECT 'MySQL is responding' as status;" 2>&1 | head -5
        fi
        
        if [ $i -eq 40 ]; then
            echo "❌ MySQL failed to start after 40 attempts!"
            echo "📋 Complete MySQL logs:"
            docker compose logs mysql
            exit 1
        fi
        
        sleep 10
    fi
done

if [ "$mysql_ready" = false ]; then
    echo "❌ MySQL failed to become ready!"
    exit 1
fi

# Set vm.overcommit_memory for Redis
echo "🔧 Setting system parameters for Redis..."
sudo sysctl vm.overcommit_memory=1 2>/dev/null || echo "   Could not set vm.overcommit_memory (may need sudo)"

# Start Redis
echo "🔧 Starting Redis service..."
docker compose up -d redis
sleep 15

# Verify Redis
echo "🔍 Verifying Redis..."
redis_ready=false
for i in {1..15}; do
    if docker compose exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        redis_ready=true
        break
    else
        echo "⏳ Waiting for Redis... (attempt $i/15)"
        
        if [ $i -eq 15 ]; then
            echo "❌ Redis failed to start!"
            echo "📋 Redis logs:"
            docker compose logs redis
            exit 1
        fi
        
        sleep 3
    fi
done

if [ "$redis_ready" = false ]; then
    echo "❌ Redis failed to become ready!"
    exit 1
fi

# Start application with extended monitoring
echo "🔧 Starting application service..."
docker compose up -d app

# Extended application monitoring
echo "🔍 Extended application monitoring..."
app_ready=false
for i in {1..30}; do
    echo "⏳ App health check $i/30..."
    
    # Check container status
    if ! docker compose ps app | grep -q "Up"; then
        echo "❌ App container not running!"
        echo "📋 App logs (last 30 lines):"
        docker compose logs app --tail 30
        
        if [ $i -eq 30 ]; then
            exit 1
        fi
        
        sleep 20
        continue
    fi
    
    # Check application health
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Application health check passed!"
        app_ready=true
        break
    else
        echo "⏳ App not ready yet... (attempt $i/30)"
        
        if [ $((i % 5)) -eq 0 ]; then
            echo "📋 Recent app logs:"
            docker compose logs app --tail 10
            
            # Test database connection from app perspective
            echo "🔍 Testing database connectivity from app container..."
            docker compose exec app nc -zv mysql 3306 || echo "   Network connectivity to MySQL failed"
        fi
        
        if [ $i -eq 30 ]; then
            echo "❌ Application health check failed after 30 attempts!"
            echo "📋 Complete app logs:"
            docker compose logs app
            exit 1
        fi
        
        sleep 20
    fi
done

if [ "$app_ready" = false ]; then
    echo "❌ Application failed to become ready!"
    exit 1
fi

echo ""
echo "🎉 Deploy berhasil dengan SSL Fix!"
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
echo "🔍 Connection verification:"
echo "   HTTP Health Check:"
curl -s http://localhost:3000/health | head -3 || echo "   Health check endpoint not responding"
echo "   MySQL Connection Test:"
docker compose exec mysql mysql -u root -prootpassword -e "SELECT 'MySQL Connection OK' as status;" 2>/dev/null || echo "   MySQL connection test failed"
echo "   Redis Connection Test:"
docker compose exec redis redis-cli ping 2>/dev/null || echo "   Redis connection test failed"