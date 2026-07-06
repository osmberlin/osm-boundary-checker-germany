# Cursor Cloud environment

This repository uses [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent). The machine setup is defined in [`.cursor/environment.json`](.cursor/environment.json).

## What the install script does

On each agent boot, Cursor runs the `install` command from `.cursor/environment.json`:

1. Installs [Bun](https://bun.sh) to `~/.bun/bin` (also appended to the shell `PATH` via `~/.bashrc`).
2. Installs pipeline system tools: `osmium-tool`, `gdal-bin` (`ogr2ogr`), `tippecanoe`, and `unzip`.
3. Runs `HUSKY=0 bun install --frozen-lockfile` to install JavaScript/TypeScript dependencies without Husky git hooks.

The default cloud base image already includes a Rust toolchain (`cargo`). Build the geom sidecar when compare or extract work needs it (see below).

## Verify the environment

After setup, confirm the repo is ready:

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun --version
bun run typecheck
cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml
```

`bun run typecheck` is a fast check that Bun, dependencies, and TypeScript are wired correctly. The Rust build is required before `bun run compare` or other pipeline steps that call the geom sidecar.

## Common agent tasks

| Goal | Command |
| --- | --- |
| Unit tests | `bun run test` |
| Lint + format + typecheck | `bun run check` |
| Build Rust geom sidecar | `cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml` |
| Quick pipeline test (skip BKG) | `bun run extract:official -- --yes && bun run extract:osm -- --yes && bun run compare -- --yes --all` |
| Full data refresh | `bun run scripts/pipeline/nightly.ts -- --phase all` |

For more runbooks and troubleshooting, see [`.cursor/skills/boundary-test-runs/SKILL.md`](.cursor/skills/boundary-test-runs/SKILL.md).

## Notes for cloud agents

- **`HUSKY=0`**: Git hooks are not available in ephemeral cloud VMs. The install script sets this automatically; use it for any manual `bun install` as well.
- **`RUST_GEOM_BIN`**: Only needed when the sidecar binary is not at the default release path. After `cargo build --release`, the default location is used automatically.
- **`DATA_ROOT`**: Overrides where `datasets/` and `data/` are read from (defaults to the repo root).
- **Large downloads**: Pipeline runs fetch Geofabrik PBFs, BKG VG25 archives, and official HTTP sources. Network egress and disk space matter for full refresh jobs.
- **Secrets**: Do not commit credentials. Use the Secrets tab in Cursor Cloud settings for API keys or login details the agent needs.

## Local vs cloud parity

Cloud setup mirrors [README.md](README.md) prerequisites:

- Bun
- Rust toolchain (on base image)
- `osmium-tool`, GDAL (`ogr2ogr`), `tippecanoe`, `unzip`

The install script covers everything except the Rust sidecar build, which is compiled on demand because it changes with source edits and is cached by `cargo` between runs.
