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

echo "✅ init-db.sql created with proper format"

# Docker cleanup
echo "🧹 Cleaning up containers..."
docker compose down --volumes --remove-orphans 2>/dev/null || true
docker system prune -f

# Remove old volumes
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

# Verify files
echo "🔍 Verifying required files..."
for file in init-db.sql docker-compose.yml Dockerfile; do
    if [ ! -f "$file" ]; then
        echo "❌ $file is missing!"
        exit 1
    fi
done
echo "✅ All required files present"

# Build and deploy
echo "🔨 Building and deploying application..."
docker compose build --no-cache --pull
docker compose up -d

# ✅ Enhanced health check dengan network debugging
echo "⏳ Waiting for services to start..."
sleep 60  # Give more time for network setup

echo "🏥 Running comprehensive health checks..."

# Check network first
echo "🔍 Checking Docker network..."
docker network ls | grep hmif || echo "⚠️  Network hmif-network not found"

# Check container connectivity
echo "🔍 Testing container connectivity..."
for i in {1..10}; do
    if docker compose exec mysql mysqladmin ping -u root -prootpassword --silent 2>/dev/null; then
        echo "✅ MySQL container is ready (attempt $i)"
        
        # Test network connectivity between containers
        if docker compose exec app nc -z mysql 3306 2>/dev/null; then
            echo "✅ App can connect to MySQL container"
            break
        else
            echo "⚠️  App cannot connect to MySQL container, attempt $i/10"
            sleep 5
        fi
    else
        echo "⏳ MySQL not ready, attempt $i/10..."
        sleep 5
    fi
    
    if [ $i -eq 10 ]; then
        echo "❌ Network connectivity failed after 10 attempts"
        echo "📋 Network debugging:"
        docker network inspect hmif-network || true
        docker compose exec app nslookup mysql || true
        docker compose exec app nc -zv mysql 3306 || true
        echo "📋 Container logs:"
        docker compose logs mysql --tail 20
        docker compose logs app --tail 20
        exit 1
    fi
done

# Check application health
echo "🔍 Checking application health..."
for i in {1..20}; do
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo "✅ Application health check passed!"
        break
    elif [ $i -eq 20 ]; then
        echo "❌ Application health check failed"
        echo "📋 App logs:"
        docker compose logs app --tail 50
        exit 1
    else
        echo "⏳ App health check attempt $i/20..."
        sleep 10
    fi
done

# Run database migration
echo "🔄 Running database migration..."
if docker compose exec app npx prisma db push --accept-data-loss --force-reset; then
    echo "✅ Database schema synchronized"
else
    echo "⚠️  Schema sync failed, trying alternative..."
    docker compose exec app npx prisma generate || true
    docker compose exec app npx prisma migrate deploy || true
fi

# Final verification
echo "🔍 Final verification..."
docker compose exec mysql mysql -u root -prootpassword hmif_app -e "SHOW TABLES;" 2>/dev/null | head -10 || echo "⚠️  Could not verify tables"

echo ""
echo "🎉 Deploy berhasil!"
echo "🌍 DuckDNS Domain: https://$DUCKDNS_DOMAIN:3443"
echo "🔓 HTTP: http://$DUCKDNS_DOMAIN:3000"  
echo "🔒 HTTPS: https://$DUCKDNS_DOMAIN:3443"
echo "📚 Swagger: https://$DUCKDNS_DOMAIN:3443/docs-swagger"
echo "🔐 OAuth: https://$DUCKDNS_DOMAIN:3443/auth/google"
echo ""
echo "📊 Final container status:"
docker compose ps
echo ""
echo "🔍 Network status:"
docker network inspect hmif-network | grep -A 5 -B 5 "Containers" || true