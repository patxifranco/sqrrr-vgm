@echo off
REM Ships local main to www.sqrrr.com: push to GitHub, then pull + restart on the VPS.
cd /d "%~dp0"
git push origin main || exit /b 1
ssh sqrrr "cd /opt/sqrrr-vgm && sudo -u sqrrr git pull --ff-only && sudo -u sqrrr npm install --omit=dev --no-audit --no-fund && systemctl restart sqrrr-site && sleep 2 && systemctl is-active sqrrr-site"
