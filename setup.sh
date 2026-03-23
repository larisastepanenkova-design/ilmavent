#!/bin/bash
cd /root/ilmavent
git pull
npm install
pm2 start src/index.js --name ilmavent
pm2 startup
pm2 save
ufw allow 3000/tcp 2>/dev/null
echo 'DONE! Server is running on port 3000'
