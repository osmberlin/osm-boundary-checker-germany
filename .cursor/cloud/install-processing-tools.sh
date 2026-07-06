#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y osmium-tool gdal-bin tippecanoe unzip

echo "Processing tools installed: osmium-tool, gdal-bin (ogr2ogr), tippecanoe, unzip"
