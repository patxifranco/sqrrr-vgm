@echo off
cd /d "%~dp0"
git push origin main || exit /b 1
ssh sqrrr "cd /opt/sqrrr-vgm && sudo -u sqrrr git pull --ff-only && sudo -u sqrrr npm install --omit=dev --no-audit --no-fund && sudo -u sqrrr sh -c 'mkdir -p bin && ([ -x bin/yt-dlp ] || curl -sL -o bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux) && chmod +x bin/yt-dlp && bin/yt-dlp -U -q' ; systemctl restart sqrrr-site && sleep 2 && systemctl is-active sqrrr-site"
