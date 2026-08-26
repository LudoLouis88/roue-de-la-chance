FROM node:22-alpine

WORKDIR /app
COPY app.js index.html package.json server.js styles.css ./
RUN mkdir -p /data

ENV PORT=3000
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.js"]
