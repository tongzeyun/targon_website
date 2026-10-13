FROM node:22.21.1-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22.21.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Keep SQL, JSON, source CLI entries, and tsx available to the separate Worker.
COPY --chown=node:node --from=build /app /app
RUN mkdir -p /app/.data/stored-files && chown -R node:node /app/.data
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
