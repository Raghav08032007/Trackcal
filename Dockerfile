FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=true
RUN npm run build
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 10001 trackcal && adduser -D -u 10001 -G trackcal trackcal
COPY --from=build --chown=trackcal:trackcal /app/.next/standalone ./
COPY --from=build --chown=trackcal:trackcal /app/.next/static ./.next/static
COPY --from=build --chown=trackcal:trackcal /app/public ./public
USER trackcal
EXPOSE 3000
CMD ["node", "server.js"]
