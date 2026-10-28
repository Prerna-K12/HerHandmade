# Stage 1: build the React app. Stage 2: serve it with Caddy (which also handles HTTPS).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
