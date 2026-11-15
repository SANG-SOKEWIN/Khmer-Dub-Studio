# Generate and review package-lock.json before this build.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY requirements-edge.txt ./
RUN python3 -m venv /opt/edge-voice && /opt/edge-voice/bin/python -m pip install --no-cache-dir -r requirements-edge.txt
COPY . .
RUN npm run build
ENV NODE_ENV=production EDGE_TTS_PYTHON=/opt/edge-voice/bin/python
EXPOSE 3000
USER node
CMD ["sh", "-c", "test -n \"$STUDIO_ACCESS_PASSWORD\" || { echo \"Set STUDIO_ACCESS_PASSWORD before hosting the studio.\" >&2; exit 1; }; exec npm start"]
