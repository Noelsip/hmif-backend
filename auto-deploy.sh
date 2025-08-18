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

# Validate configurations (existing code...)

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

# Docker cleanup
echo "🧹 Cleaning up containers..."
docker compose down --volumes --remove-orphans 2>/dev/null || true
docker system prune -f
docker volume rm $(docker volume ls -q | grep mysql) 2>/dev/null || true

# Generate SSL (existing code...)

# ✅ Create .env.docker with EXPLICIT DATABASE_URL
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

# Build and deploy
echo "🔨 Building and deploying application..."
docker compose build --no-cache --pull
docker compose up -d

# ✅ Enhanced health check with MySQL debugging
echo "⏳ Waiting for MySQL to fully initialize..."
sleep 90  # Give MySQL more time

echo "🔍 Testing MySQL connection directly..."
for i in {1..10}; do
    if docker compose exec mysql mysqladmin ping -u root -prootpassword --silent 2>/dev/null; then
        echo "✅ MySQL is ready and accepts connections"
        
        # Test database creation
        if docker compose exec mysql mysql -u root -prootpassword -e "SHOW DATABASES LIKE 'hmif_app';" | grep -q hmif_app; then
            echo "✅ Database hmif_app exists"
        else
            echo "🔧 Creating database hmif_app..."
            docker compose exec mysql mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS hmif_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        fi
        break
    else
        echo "⏳ MySQL not ready, attempt $i/10..."
        sleep 10
        
        if [ $i -eq 10 ]; then
            echo "❌ MySQL failed to start properly"
            echo "📋 MySQL logs:"
            docker compose logs mysql --tail 30
            exit 1
        fi
    fi
done

# Test app container MySQL access
echo "🔍 Testing MySQL access from app container..."
for i in {1..5}; do
    if docker compose exec app mysql -h mysql -u root -prootpassword -e "SELECT 'App can connect to MySQL' as status;" 2>/dev/null; then
        echo "✅ App container can connect to MySQL"
        break
    else
        echo "⏳ App->MySQL connection test attempt $i/5..."
        sleep 5
        
        if [ $i -eq 5 ]; then
            echo "❌ App cannot connect to MySQL"
            echo "📋 App logs:"
            docker compose logs app --tail 20
            echo "📋 Network debug:"
            docker compose exec app nslookup mysql || true
            exit 1
        fi
    fi
done

# Check application health
echo "🔍 Checking application health..."
for i in {1..30}; do
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo "✅ Application health check passed!"
        break
    elif [ $i -eq 30 ]; then
        echo "❌ Application health check failed after 30 attempts"
        echo "📋 App logs:"
        docker compose logs app --tail 50
        exit 1
    else
        echo "⏳ App health check attempt $i/30..."
        sleep 15
    fi
done

echo ""
echo "🎉 Deploy berhasil!"
echo "🌍 DuckDNS Domain: https://$DUCKDNS_DOMAIN:3443"
echo "🔓 HTTP: http://$DUCKDNS_DOMAIN:3000"  
echo "🔒 HTTPS: https://$DUCKDNS_DOMAIN:3443"
echo "🔐 OAuth: https://$DUCKDNS_DOMAIN:3443/auth/google"
echo ""
echo "📊 Final status:"
docker compose ps