#!/bin/sh
set -e

# Ensure the public storage symlink exists so uploaded media URLs
# (/storage/...) resolve. Runs on every container start and is idempotent.
if [ ! -e "${APACHE_DOCUMENT_ROOT:-/var/www/html/public}/storage" ]; then
    echo "Creating public/storage symlink..."
    php /var/www/html/artisan storage:link
fi

exec "$@"