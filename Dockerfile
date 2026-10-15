FROM public.ecr.aws/docker/library/node@sha256:25b3eb23a00590b7499f2a2ce939322727fcce1b15fdd69754fcd09536a3ae2c AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM public.ecr.aws/docker/library/node@sha256:25b3eb23a00590b7499f2a2ce939322727fcce1b15fdd69754fcd09536a3ae2c AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Keep SQL, JSON, source CLI entries, and tsx available to the separate Worker.
COPY --chown=node:node --from=build /app /app
RUN mkdir -p /app/.data/stored-files && chown -R node:node /app/.data
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
