#!/bin/bash
set -e

echo "🚀 HMIF Backend Auto Deploy with DuckDNS"
echo "════════════════════════════════════════"

# Load production credentials (file harus sudah ada dari GitHub Actions)
if [ ! -f ".env.production.local" ]; then
    echo "❌ .env.production.local tidak ditemukan!"
    echo "💡 File ini seharusnya dibuat oleh GitHub Actions"
    echo "💡 Atau jalankan manual setup di VPS"
    exit 1
fi

echo "📥 Loading production credentials..."
source .env.production.local

# Validate DuckDNS domain
if [ -z "$DUCKDNS_DOMAIN" ] || [ "$DUCKDNS_DOMAIN" == "your-domain.duckdns.org" ] || [ "$DUCKDNS_DOMAIN" == "" ]; then
    echo "❌ DUCKDNS_DOMAIN belum dikonfigurasi dengan benar!"
    echo "   Current value: '$DUCKDNS_DOMAIN'"
    echo "💡 Pastikan GitHub secret DUCKDNS_DOMAIN sudah diset"
    echo "💡 Atau edit manual .env.production.local di VPS"
    exit 1
fi

# Validate Google OAuth credentials
if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" == "your-google-client-id" ] || [ "$GOOGLE_CLIENT_ID" == "" ]; then
    echo "❌ GOOGLE_CLIENT_ID belum dikonfigurasi dengan benar!"
    echo "   Current value: '${GOOGLE_CLIENT_ID:0:20}...'"
    echo "💡 Pastikan GitHub secret GOOGLE_CLIENT_ID sudah diset"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ] || [ "$GOOGLE_CLIENT_SECRET" == "your-google-client-secret" ] || [ "$GOOGLE_CLIENT_SECRET" == "" ]; then
    echo "❌ GOOGLE_CLIENT_SECRET belum dikonfigurasi dengan benar!"
    echo "💡 Pastikan GitHub secret GOOGLE_CLIENT_SECRET sudah diset"
    exit 1
fi

# Validate JWT secrets
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" == "your-jwt-secret-minimum-32-characters" ] || [ "$JWT_SECRET" == "" ]; then
    echo "❌ JWT_SECRET belum dikonfigurasi dengan benar!"
    echo "💡 Pastikan GitHub secret JWT_SECRET sudah diset"
    exit 1
fi

echo "🌐 DuckDNS Domain: $DUCKDNS_DOMAIN"
echo "🔐 Google OAuth Client ID: ${GOOGLE_CLIENT_ID:0:20}..."
echo "🔑 JWT Secret: ${JWT_SECRET:0:10}... (${#JWT_SECRET} characters)"

# ✅ Show loaded environment for debugging
echo "📋 Environment validation:"
echo "   DUCKDNS_DOMAIN: $DUCKDNS_DOMAIN"
echo "   GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:0:30}..."
echo "   JWT_SECRET length: ${#JWT_SECRET}"
echo "   SESSION_SECRET length: ${#SESSION_SECRET}"
echo "   ADMIN_EMAILS: ${ADMIN_EMAILS}"

# Docker cleanup
echo "🧹 Cleaning up containers..."
docker compose down --volumes --remove-orphans 2>/dev/null || true
docker system prune -f

# Generate SSL certificate dengan DuckDNS domain
echo "🔐 Setting up SSL for DuckDNS domain..."
mkdir -p ssl

if [ ! -f "ssl/certificate.pem" ] || [ ! -f "ssl/private-key.pem" ]; then
    echo "🔐 Generating SSL certificate for: $DUCKDNS_DOMAIN"
    
    openssl genrsa -out ssl/private-key.pem 2048
    openssl req -new -x509 -key ssl/private-key.pem -out ssl/certificate.pem -days 365 \
        -subj "/C=ID/ST=Jakarta/L=Jakarta/O=HMIF/CN=$DUCKDNS_DOMAIN" \
        -addext "subjectAltName=DNS:$DUCKDNS_DOMAIN,DNS:*.duckdns.org"
    
    chmod 600 ssl/private-key.pem ssl/certificate.pem
    echo "✅ SSL certificate generated"
else
    echo "✅ SSL certificate already exists"
fi

# Create .env.docker dengan DuckDNS configuration
echo "📝 Creating Docker environment with DuckDNS..."

cat > .env.docker << EOF
# Docker Production Environment - DuckDNS
PORT=3000
NODE_ENV=production

# DuckDNS Configuration
DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN}

# VPS Configuration (fallback)
VPS_IP=31.97.51.165
HOST_IP=31.97.51.165
SERVER_HOST=0.0.0.0

# SSL Configuration
SSL_ENABLED=true
HTTPS_PORT=3443
SSL_PRIVATE_KEY_PATH=./ssl/private-key.pem
SSL_CERTIFICATE_PATH=./ssl/certificate.pem

# URLs - DuckDNS HTTPS
EXTERNAL_URL=https://${DUCKDNS_DOMAIN}:3443
FRONTEND_URL=https://${DUCKDNS_DOMAIN}:3443

# Database & Redis
DATABASE_URL=mysql://root:rootpassword@mysql:3306/hmif_app
REDIS_URL=redis://redis:6379

# Google OAuth dengan DuckDNS
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_CALLBACK_URL=https://${DUCKDNS_DOMAIN}:3443/auth/google/callback

# JWT & Security
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
REFRESH_TOKEN_EXPIRES_IN=7d
SESSION_SECRET=${SESSION_SECRET}

# ImageKit
IMAGEKIT_PUBLIC_KEY=${IMAGEKIT_PUBLIC_KEY}
IMAGEKIT_PRIVATE_KEY=${IMAGEKIT_PRIVATE_KEY}
IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT}

# Admin
ADMIN_EMAILS=${ADMIN_EMAILS}
LOG_LEVEL=info
EOF

echo "✅ .env.docker created with DuckDNS configuration"

# Build and deploy
echo "🔨 Building and deploying application..."
docker compose build --no-cache
docker compose up -d

# Health check
echo "⏳ Waiting for services to start..."
sleep 30

echo "🏥 Health check..."
for i in {1..20}; do
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo "✅ Health check passed!"
        break
    elif [ $i -eq 20 ]; then
        echo "❌ Health check failed after 20 attempts"
        echo "📋 Container status:"
        docker compose ps
        echo "📋 App logs:"
        docker compose logs --tail 50 app
        echo "📋 MySQL logs:"
        docker compose logs --tail 20 mysql
        echo "📋 Redis logs:"
        docker compose logs --tail 10 redis
        exit 1
    else
        echo "⏳ Health check attempt $i/20..."
        sleep 15
    fi
done

# OAuth validation
echo "🔍 Validating OAuth configuration..."
CALLBACK_URL="https://${DUCKDNS_DOMAIN}:3443/auth/google/callback"
echo "   Expected callback URL: $CALLBACK_URL"
echo "   Make sure this URL is registered in Google Cloud Console!"

echo ""
echo "🎉 Deploy berhasil!"
echo "🌍 DuckDNS Domain: https://$DUCKDNS_DOMAIN:3443"
echo "🔓 HTTP (redirects): http://$DUCKDNS_DOMAIN:3000"
echo "🔒 HTTPS: https://$DUCKDNS_DOMAIN:3443"
echo "📚 Swagger: https://$DUCKDNS_DOMAIN:3443/docs-swagger"
echo "🔐 OAuth: https://$DUCKDNS_DOMAIN:3443/auth/google"
echo ""
echo "⚠️  IMPORTANT CHECKLIST:"
echo "   1. DuckDNS domain: $DUCKDNS_DOMAIN resolves to your VPS IP"
echo "   2. Google Console authorized redirect URI: $CALLBACK_URL"
echo "   3. Accept SSL certificate in browser (self-signed)"
echo ""
echo "📊 Final container status:"
docker compose ps