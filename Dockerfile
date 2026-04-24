FROM oven/bun:1-debian

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  build-essential \
  curl \
  gdal-bin \
  osmium-tool \
  pkg-config \
  tippecanoe \
  unzip \
  && rm -rf /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

COPY package.json bun.lock tsconfig.json run.ts ./
COPY scripts ./scripts
COPY rust ./rust
COPY report ./report
COPY datasets ./datasets
RUN mkdir -p /opt/seed && cp -R ./datasets /opt/seed/datasets
COPY bkg.config.json oxfmt.config.ts oxlint.config.ts .gitignore areas.gen.json ./
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh
RUN bun install --frozen-lockfile
RUN cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml
RUN bun run report:build

ENV PORT=4173
ENV TZ=Europe/Berlin
ENV DATA_VOLUME_ROOT=/data
ENV WORKSPACE_ROOT=/workspace

EXPOSE 4173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "run", "report:preview"]
