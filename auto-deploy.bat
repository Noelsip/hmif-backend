@echo off
echo 🚀 HMIF Backend Auto-Deploy Script
echo.

echo 🌐 Auto-detecting network configuration...
node docker-auto-env.js

echo.
echo 📦 Building and starting Docker containers...
docker-compose down
docker-compose up --build -d

echo.
echo ⏳ Waiting for services to start...
timeout /t 15

echo.
echo 🧪 Testing auto-generated endpoints...
for /f "tokens=2 delims==" %%i in ('findstr "EXTERNAL_URL" .env.docker') do set EXTERNAL_URL=%%i

echo Testing: %EXTERNAL_URL%/health
curl -s %EXTERNAL_URL%/health

echo.
echo Testing: %EXTERNAL_URL%/network-info
curl -s %EXTERNAL_URL%/network-info

echo.
echo ✅ Auto-deployment complete!
echo 📱 Access from any device: %EXTERNAL_URL%
echo 📚 Documentation: %EXTERNAL_URL%/docs
echo 🌐 Network Info: %EXTERNAL_URL%/network-info

pause