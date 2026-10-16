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

# Stage 2: Serve with Nginx
FROM nginx:alpine

ENV PORT=80

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
