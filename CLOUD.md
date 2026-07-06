# Cursor Cloud environment

This repository uses [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent). The machine setup is defined in [`.cursor/environment.json`](.cursor/environment.json).

## Install tiers

Setup is split so lightweight tasks (Dependabot PR reviews, lint, typecheck) boot fast without GDAL and other pipeline binaries.

### Always (on agent boot)

Cursor runs the `install` command from `.cursor/environment.json`:

1. Installs [Bun](https://bun.sh) to `~/.bun/bin` (also appended to the shell `PATH` via `~/.bashrc`).
2. Runs `HUSKY=0 bun install --frozen-lockfile` to install JavaScript/TypeScript dependencies without Husky git hooks.

Enough for:

- `bun run check`, `bun run typecheck`, `bun run test`
- Report app work under `report/`
- Reviewing Dependabot dependency bumps

### On demand (pipeline / backend processing)

When working on download, extract, compare, or nightly refresh, install system tools and build the Rust sidecar:

```bash
.cursor/cloud/install-processing-tools.sh
cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml
```

`install-processing-tools.sh` installs `osmium-tool`, `gdal-bin` (`ogr2ogr`), `tippecanoe`, and `unzip` — the same packages as CI ([`.github/workflows/data-refresh.yml`](.github/workflows/data-refresh.yml)). The default cloud base image already includes a Rust toolchain (`cargo`).

## Verify the environment

**Dependency / app work** (after boot):

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun --version
bun run typecheck
```

**Pipeline work** (after processing tools + Rust build):

```bash
.cursor/cloud/install-processing-tools.sh
cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml
bun run test
```

## Common agent tasks

| Goal | Prerequisites | Command |
| --- | --- | --- |
| Lint + format + typecheck | Boot only | `bun run check` |
| Unit tests | Boot only | `bun run test` |
| Build Rust geom sidecar | Processing tools | `cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml` |
| Quick pipeline test (skip BKG) | Processing tools + sidecar | `bun run extract:official -- --yes && bun run extract:osm -- --yes && bun run compare -- --yes --all` |
| Full data refresh | Processing tools + sidecar | `bun run scripts/pipeline/nightly.ts -- --phase all` |

For more runbooks and troubleshooting, see [`.cursor/skills/boundary-test-runs/SKILL.md`](.cursor/skills/boundary-test-runs/SKILL.md).

## Notes for cloud agents

- **`HUSKY=0`**: Git hooks are not available in ephemeral cloud VMs. The install script sets this automatically; use it for any manual `bun install` as well.
- **`RUST_GEOM_BIN`**: Only needed when the sidecar binary is not at the default release path. After `cargo build --release`, the default location is used automatically.
- **`DATA_ROOT`**: Overrides where `datasets/` and `data/` are read from (defaults to the repo root).
- **Large downloads**: Pipeline runs fetch Geofabrik PBFs, BKG VG25 archives, and official HTTP sources. Network egress and disk space matter for full refresh jobs.
- **Secrets**: Do not commit credentials. Use the Secrets tab in Cursor Cloud settings for API keys or login details the agent needs.

## Local vs cloud parity

[README.md](README.md) lists all local prerequisites. In cloud:

| Tool | When |
| --- | --- |
| Bun + JS deps | Every boot (`environment.json`) |
| Rust toolchain | On base image |
| `osmium-tool`, GDAL, `tippecanoe`, `unzip` | On demand (`.cursor/cloud/install-processing-tools.sh`) |
| Rust geom sidecar binary | On demand (`cargo build --release`) |
