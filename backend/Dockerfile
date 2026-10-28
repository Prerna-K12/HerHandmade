FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY db ./db
# Photos are stored in /data/uploads (a Docker volume). The node user must own it.
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
