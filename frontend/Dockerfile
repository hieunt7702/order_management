# Stage 1: Build React/Vite SPA
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY .npmrc* ./
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

# Pass backend API URL at build time (e.g. https://backend-production.up.railway.app/api/v1)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm run build

# Stage 2: Production SPA Runner using standard Node + serve (Zero Nginx envsubst bugs)
FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 5173

CMD ["sh", "-c", "serve -s dist -l ${PORT:-5173}"]
