FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY app ./app
COPY bin ./bin
COPY babel.config.json ./babel.config.json

RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/bin ./bin

USER node

ENTRYPOINT ["node", "/app/bin/fakeit"]
CMD ["--help"]
