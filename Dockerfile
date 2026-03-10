FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
