#!/bin/bash
set -e

echo "🚀 HMIF Backend Auto Deploy with DuckDNS"
echo "════════════════════════════════════════"

# Load production credentials
if [ ! -f ".env.production.local" ]; then
    echo "❌ .env.production.local tidak ditemukan!"
    exit 1
fi

echo "📥 Loading production credentials..."
source .env.production.local

# Validate configurations
if [ -z "$DUCKDNS_DOMAIN" ] || [ "$DUCKDNS_DOMAIN" == "your-domain.duckdns.org" ]; then
    echo "❌ DUCKDNS_DOMAIN belum dikonfigurasi!"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" == "your-google-client-id" ]; then
    echo "❌ GOOGLE_CLIENT_ID belum dikonfigurasi!"
    exit 1
fi

echo "🌐 DuckDNS Domain: $DUCKDNS_DOMAIN"
echo "🔐 Google OAuth Client ID: ${GOOGLE_CLIENT_ID:0:20}..."

# ✅ CREATE INIT-DB.SQL FILE (Critical Fix)
echo "📝 Creating init-db.sql file..."
cat > init-db.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hmif_app;
GRANT ALL PRIVILEGES ON hmif_app.* TO 'root'@'%';
FLUSH PRIVILEGES;
EOF

# Ensure proper line endings (Unix format)
if command -v dos2unix >/dev/null 2>&1; then
    dos2unix init-db.sql 2>/dev/null || true
fi

# Set proper file permissions
chmod 644 init-db.sql

echo "✅ init-db.sql created with proper format"

# Docker cleanup
echo "🧹 Cleaning up containers..."
docker compose down --volumes --remove-orphans 2>/dev/null || true
docker system prune -f

# ✅ Remove old volumes to ensure fresh start
echo "🗑️  Removing old database volumes..."
docker volume rm $(docker volume ls -q | grep mysql) 2>/dev/null || true

# Generate SSL certificate
echo "🔐 Setting up SSL..."
mkdir -p ssl

if [ ! -f "ssl/certificate.pem" ] || [ ! -f "ssl/private-key.pem" ]; then
    echo "🔐 Generating SSL certificate for: $DUCKDNS_DOMAIN"
    openssl genrsa -out ssl/private-key.pem 2048
    openssl req -new -x509 -key ssl/private-key.pem -out ssl/certificate.pem -days 365 \
        -subj "/C=ID/ST=Jakarta/L=Jakarta/O=HMIF/CN=$DUCKDNS_DOMAIN" \
        -addext "subjectAltName=DNS:$DUCKDNS_DOMAIN,DNS:*.duckdns.org"
    chmod 600 ssl/private-key.pem ssl/certificate.pem
    echo "✅ SSL certificate generated"
fi

# Create .env.docker
echo "📝 Creating Docker environment..."
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

echo "✅ .env.docker created"

# ✅ Verify files before building
echo "🔍 Verifying required files..."
if [ ! -f "init-db.sql" ]; then
    echo "❌ init-db.sql is missing!"
    exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml is missing!"
    exit 1
fi

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile is missing!"
    exit 1
fi

echo "✅ All required files present"

# Build and deploy
echo "🔨 Building and deploying application..."
docker compose build --no-cache --pull
docker compose up -d

# Enhanced health check
echo "⏳ Waiting for services to start..."
sleep 45  # Give more time for MySQL initialization

echo "🏥 Running health checks..."

# Check MySQL first
echo "🔍 Checking MySQL..."
for i in {1..20}; do
    if docker compose exec mysql mysqladmin ping -u root -prootpassword --silent 2>/dev/null; then
        echo "✅ MySQL is ready (attempt $i)"
        break
    else
        echo "⏳ MySQL not ready, attempt $i/20..."
        sleep 5
    fi
    
    if [ $i -eq 20 ]; then
        echo "❌ MySQL failed to start after 20 attempts"
        echo "📋 MySQL logs:"
        docker compose logs mysql
        exit 1
    fi
done

# Check if database exists
echo "🔍 Verifying database..."
DB_EXISTS=$(docker compose exec mysql mysql -u root -prootpassword -e "SHOW DATABASES LIKE 'hmif_app';" -s -N 2>/dev/null | wc -l)
if [ "$DB_EXISTS" -eq 0 ]; then
    echo "⚠️  Database hmif_app not found, creating manually..."
    docker compose exec mysql mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

# Check application health
echo "🔍 Checking application..."
for i in {1..15}; do
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo "✅ Application health check passed!"
        break
    elif [ $i -eq 15 ]; then
        echo "❌ Application health check failed"
        echo "📋 App logs:"
        docker compose logs --tail 50 app
        exit 1
    else
        echo "⏳ App health check attempt $i/15..."
        sleep 10
    fi
done

# Run database migration
echo "🔄 Running database migration..."
if docker compose exec app npx prisma db push --accept-data-loss --force-reset; then
    echo "✅ Database schema synchronized"
else
    echo "⚠️  Schema sync failed, trying alternative..."
    docker compose exec app npx prisma generate
    docker compose exec app npx prisma migrate deploy || true
fi

# Final verification
echo "🔍 Final verification..."
docker compose exec mysql mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null | head -10

echo ""
echo "🎉 Deploy berhasil!"
echo "🌍 DuckDNS Domain: https://$DUCKDNS_DOMAIN:3443"
echo "🔓 HTTP: http://$DUCKDNS_DOMAIN:3000"
echo "🔒 HTTPS: https://$DUCKDNS_DOMAIN:3443"
echo "📚 Swagger: https://$DUCKDNS_DOMAIN:3443/docs-swagger"
echo "🔐 OAuth: https://$DUCKDNS_DOMAIN:3443/auth/google"
echo ""
echo "📊 Container status:"
docker compose ps