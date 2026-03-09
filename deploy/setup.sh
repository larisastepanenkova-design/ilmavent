#!/bin/bash
# === Деплой Ilmavent на сервер ===
set -e

echo "🚀 Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "📦 Установка PM2..."
npm install -g pm2

echo "📁 Создание папки проекта..."
mkdir -p /opt/ilmavent
cd /opt/ilmavent

echo "✅ Базовая установка завершена!"
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo "PM2: $(pm2 -v)"
