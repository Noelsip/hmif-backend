@echo off
echo Setting up Windows Firewall for HMIF Backend...

netsh advfirewall firewall add rule name="HMIF Backend HTTP" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="HMIF Backend HTTP Out" dir=out action=allow protocol=TCP localport=3000

echo Firewall rules added for port 3000
echo You can now access the server from other devices
pause