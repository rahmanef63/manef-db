#!/bin/sh
set -eu

: "${UPSTREAM_CONVEX_URL:?UPSTREAM_CONVEX_URL is required}"
: "${PUBLIC_DB_DOMAIN:=dbgg.rahmanef.com}"

envsubst '${UPSTREAM_CONVEX_URL} ${PUBLIC_DB_DOMAIN}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -t
exec nginx -g 'daemon off;'
