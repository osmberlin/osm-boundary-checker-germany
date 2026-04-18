-- Draft runtime schema for the SQLite/Turso migration track.
-- Keep this engine-agnostic SQL so we can swap SQLite-compatible engines if needed.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS areas (
  area_id TEXT PRIMARY KEY,
  display_name TEXT,
  metrics_crs TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS area_runs (
  area_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  metrics_crs TEXT NOT NULL,
  has_pmtiles INTEGER NOT NULL,
  has_unmatched_pmtiles INTEGER NOT NULL,
  tippecanoe_layer TEXT NOT NULL,
  mean_iou REAL NOT NULL,
  matched_count INTEGER NOT NULL,
  official_only_count INTEGER NOT NULL,
  unmatched_count INTEGER NOT NULL,
  PRIMARY KEY (area_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_area_runs_area_generated
  ON area_runs (area_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS area_rows (
  area_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  canonical_match_key TEXT NOT NULL,
  name_label TEXT NOT NULL,
  category TEXT NOT NULL,
  osm_relation_id TEXT NOT NULL,
  map_bbox_json TEXT,
  iou REAL,
  area_diff_pct REAL,
  symmetric_diff_pct REAL,
  hausdorff_m REAL,
  official_area_m2 REAL,
  osm_area_m2 REAL,
  PRIMARY KEY (area_id, run_id, canonical_match_key)
);

CREATE INDEX IF NOT EXISTS idx_area_rows_area_run_category
  ON area_rows (area_id, run_id, category);

CREATE TABLE IF NOT EXISTS area_row_props (
  area_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  canonical_match_key TEXT NOT NULL,
  official_props_json TEXT,
  osm_props_json TEXT,
  official_for_edit_path TEXT,
  PRIMARY KEY (area_id, run_id, canonical_match_key)
);

CREATE TABLE IF NOT EXISTS unmatched_rows (
  area_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  canonical_match_key TEXT NOT NULL,
  name_label TEXT NOT NULL,
  osm_relation_id TEXT NOT NULL,
  admin_level TEXT,
  map_bbox_json TEXT,
  PRIMARY KEY (area_id, run_id, canonical_match_key)
);

CREATE TABLE IF NOT EXISTS source_metadata (
  area_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  official_json TEXT,
  osm_json TEXT,
  ogc_sources_json TEXT,
  PRIMARY KEY (area_id, run_id)
);
