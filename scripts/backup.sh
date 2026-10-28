#!/usr/bin/env bash
# Backs up the database and the uploaded photos. Run it from anywhere; it finds the project folder.
# Nightly at 2 am (crontab -e):   0 2 * * * /path/to/herhandmade/scripts/backup.sh >> /path/to/herhandmade/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

STAMP=$(date +%F)
mkdir -p backups

docker compose exec -T postgres pg_dump -U herhandmade herhandmade | gzip > "backups/db-$STAMP.sql.gz"
docker run --rm -v herhandmade_uploads:/data:ro -v "$PWD/backups":/backup alpine \
  tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .

# Keep 14 days
find backups -type f \( -name 'db-*.gz' -o -name 'uploads-*.gz' \) -mtime +14 -delete

echo "Backup done: backups/db-$STAMP.sql.gz and backups/uploads-$STAMP.tar.gz"
# IMPORTANT: also copy the backups folder to another place (another computer, Google Drive...), for example:
#   rclone copy backups remote:herhandmade-backups
