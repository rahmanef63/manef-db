#!/bin/sh
set -eu

: "${UPSTREAM_CONVEX_URL:?UPSTREAM_CONVEX_URL is required}"
: "${PUBLIC_DB_DOMAIN:=dbgg.rahmanef.com}"

# Extract host from https://<host>/... for SNI + Host header to upstream
UPSTREAM_CONVEX_HOST="$(printf '%s' "$UPSTREAM_CONVEX_URL" | sed -E 's#^[a-zA-Z]+://([^/:]+).*$#\1#')"
: "${UPSTREAM_CONVEX_HOST:?failed to parse UPSTREAM_CONVEX_HOST}"

export UPSTREAM_CONVEX_HOST

envsubst '${UPSTREAM_CONVEX_URL} ${PUBLIC_DB_DOMAIN} ${UPSTREAM_CONVEX_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -t
exec nginx -g 'daemon off;'
