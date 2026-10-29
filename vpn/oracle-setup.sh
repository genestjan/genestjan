#!/bin/bash
# Monggols VPN: first-boot setup for an Oracle Cloud Always Free Ubuntu server.
#
# Paste this whole file into "Initialization script" when creating the server.
# Change ONE thing before pasting: the password on the ADMIN_PASSWORD line.
#
# What it builds:
#   wg-easy  (github.com/wg-easy/wg-easy)  the WireGuard VPN and its admin page
#   Caddy    (github.com/caddyserver/caddy) puts the admin page behind real HTTPS
#
# Devices connect to, and the admin page lives at, VPN_DOMAIN. Point that name
# at the server with a DNS A record. Using a name rather than the raw IP means
# that if the server is ever rebuilt, you change one DNS record and every
# device keeps working, instead of everyone re-scanning a QR code.
#
# Leave VPN_DOMAIN empty ("") to skip DNS entirely and use a free address:
# https://<your-ip-with-dashes>.sslip.io, e.g. 129.146.10.20 is
# https://129-146-10-20.sslip.io
set -euo pipefail

VPN_DOMAIN="vpn.genestjanramirez.com"
ADMIN_USERNAME="monggols"
ADMIN_PASSWORD="CHANGE-ME-letters-and-numbers-only-16-plus"

exec > /var/log/monggols-setup.log 2>&1

# 1. Oracle's Ubuntu images block every port except SSH on the server's own
#    firewall. Open the three this needs, and save the rules before Docker
#    starts so Docker's own rules never end up in the saved set.
iptables -I INPUT -p udp --dport 51820 -j ACCEPT
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT
if command -v netfilter-persistent >/dev/null; then
  netfilter-persistent save
fi

# 1b. The free AMD server (VM.Standard.E2.1.Micro) has only 1 GB of memory,
#     not enough to install Docker and pull images without freezing. A 2 GB
#     swap file gives it room. Harmless on the bigger Arm server.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Docker, from Docker's official installer.
curl -fsSL https://get.docker.com | sh

# 3. The address devices connect to and the admin page is served on. With no
#    domain, sslip.io turns 1.2.3.4 into 1-2-3-4.sslip.io, which still lets
#    Caddy get a real certificate.
PUBLIC_IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)
if [ -n "$VPN_DOMAIN" ]; then
  ADMIN_HOST="$VPN_DOMAIN"
  CLIENT_HOST="$VPN_DOMAIN"
else
  ADMIN_HOST="${PUBLIC_IP//./-}.sslip.io"
  CLIENT_HOST="$PUBLIC_IP"
fi

mkdir -p /opt/monggols
cd /opt/monggols

cat > Caddyfile <<EOF
${ADMIN_HOST} {
	reverse_proxy wg-easy:80
}
EOF

# IPv6 is off: Oracle networks do not route it by default, and a VPN handing
# out IPv6 with nowhere to send it makes some apps hang.
cat > compose.yml <<EOF
services:
  wg-easy:
    image: ghcr.io/wg-easy/wg-easy:15
    container_name: wg-easy
    environment:
      - PORT=80
      - DISABLE_IPV6=true
      - INIT_ENABLED=true
      - INIT_USERNAME=${ADMIN_USERNAME}
      - INIT_PASSWORD=${ADMIN_PASSWORD}
      - INIT_HOST=${CLIENT_HOST}
      - INIT_PORT=51820
      - INIT_DNS=1.1.1.1,1.0.0.1
    volumes:
      - etc_wireguard:/etc/wireguard
      - /lib/modules:/lib/modules:ro
    ports:
      - "51820:51820/udp"
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1

  caddy:
    image: caddy:2-alpine
    container_name: caddy
    ports:
      - "80:80/tcp"
      - "443:443/tcp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  etc_wireguard:
  caddy_data:
  caddy_config:
EOF

docker compose up -d

# 4. The INIT_ settings are only read on the very first start, which creates
#    the admin account. After that, take the password out of the file on disk
#    so it does not sit there in plain text, and restart without it.
sleep 120
sed -i '/INIT_/d' compose.yml
docker compose up -d

echo "Done. Admin page: https://${ADMIN_HOST}"
