#!/usr/bin/env sh
set -eu

DATA_VOLUME_ROOT="${DATA_VOLUME_ROOT:-/data}"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"

mkdir -p "${DATA_VOLUME_ROOT}/datasets" "${DATA_VOLUME_ROOT}/cache" "${DATA_VOLUME_ROOT}/logs"

if [ -z "$(ls -A "${DATA_VOLUME_ROOT}/datasets" 2>/dev/null)" ] && [ -d "/opt/seed/datasets" ]; then
  cp -R /opt/seed/datasets/. "${DATA_VOLUME_ROOT}/datasets/"
fi

rm -rf "${WORKSPACE_ROOT}/datasets" "${WORKSPACE_ROOT}/.cache" "${WORKSPACE_ROOT}/data"
ln -s "${DATA_VOLUME_ROOT}/datasets" "${WORKSPACE_ROOT}/datasets"
ln -s "${DATA_VOLUME_ROOT}/cache" "${WORKSPACE_ROOT}/.cache"
ln -s "${DATA_VOLUME_ROOT}/logs" "${WORKSPACE_ROOT}/data"

exec "$@"
