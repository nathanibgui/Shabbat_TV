FROM nginx:alpine AS runner

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy web app
COPY app.html /usr/share/nginx/html/app.html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://localhost/health", "||", "exit", "1"]

EXPOSE 80
