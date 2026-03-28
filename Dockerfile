FROM oven/bun:1-debian

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gdal-bin \
  osmium-tool \
  tippecanoe \
  unzip \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock tsconfig.json run.ts ./
COPY scripts ./scripts
COPY report ./report
COPY datasets ./datasets
COPY bkg.config.json biome.jsonc .gitignore __areas.json ./
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh
RUN bun install --frozen-lockfile
RUN bun run report:build

ENV PORT=4173
ENV TZ=Europe/Berlin
ENV DATA_VOLUME_ROOT=/data
ENV WORKSPACE_ROOT=/workspace

EXPOSE 4173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "run", "report:preview"]
