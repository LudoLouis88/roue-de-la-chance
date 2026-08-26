FROM nginx:1.27-alpine

COPY --chown=nginx:nginx . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
