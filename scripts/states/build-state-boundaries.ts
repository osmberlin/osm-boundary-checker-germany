/**
 * Writes `report/public/data/states/<code>.geojson`: one simplified outline per Land for the map
 * mask and the zoom of the state filter. Source is the exact VG25 Länder of `de-laender`
 * (run `bun run extract:official -- --area de-laender` first). The row assignment itself uses the
 * exact polygons at compare time, never these files.
 *
 * Run: `bun run states:boundaries`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stateSourcePath } from '../compare/lib/stateAssignment.ts'
import { germanStateByArsPrefix } from '../shared/germanStates.ts'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

/** 50 m keeps every Land below ~130 KB and is about one pixel at zoom 12. */
const SIMPLIFY_METERS = 50
const COORDINATE_PRECISION = 5

function ogr2ogr(args: string[]) {
  const r = spawnSync('ogr2ogr', args, { encoding: 'utf-8' })
  if (r.status !== 0) throw new Error(`ogr2ogr ${args.join(' ')} failed: ${r.stderr}`)
}

const workspaceRoot = workspaceRootFromHere(import.meta.url)
const source = stateSourcePath(runtimeRootFromWorkspace(workspaceRoot))
const outDir = join(workspaceRoot, 'report', 'public', 'data', 'states')
const tmp = mkdtempSync(join(tmpdir(), 'state-boundaries-'))
try {
  const projected = join(tmp, 'projected.gpkg')
  ogr2ogr(['-f', 'GPKG', projected, source, '-nln', 'lan', '-t_srs', 'EPSG:25832'])
  const dissolved = join(tmp, 'dissolved.gpkg')
  ogr2ogr([
    '-f',
    'GPKG',
    dissolved,
    projected,
    '-nln',
    'states',
    '-nlt',
    'MULTIPOLYGON',
    '-dialect',
    'SQLITE',
    '-sql',
    `SELECT substr(ARS, 1, 2) AS ars, ST_SimplifyPreserveTopology(ST_Union(geom), ${SIMPLIFY_METERS}) AS geom FROM lan GROUP BY substr(ARS, 1, 2)`,
  ])
  const seq = join(tmp, 'states.geojsonl')
  ogr2ogr([
    '-f',
    'GeoJSONSeq',
    seq,
    dissolved,
    'states',
    '-t_srs',
    'EPSG:4326',
    '-lco',
    `COORDINATE_PRECISION=${COORDINATE_PRECISION}`,
  ])
  mkdirSync(outDir, { recursive: true })
  const lines = readFileSync(seq, 'utf-8').split('\n').filter(Boolean)
  for (const line of lines) {
    const feature = JSON.parse(line) as { properties: { ars: string }; geometry: unknown }
    const state = germanStateByArsPrefix(feature.properties.ars)
    if (!state) throw new Error(`Unknown ARS prefix ${feature.properties.ars}`)
    const out = {
      type: 'Feature',
      properties: {
        code: state.code,
        name: state.name,
        source: 'BKG VG25 Länder, © GeoBasis-DE / BKG, dl-de/by-2-0',
      },
      geometry: feature.geometry,
    }
    writeFileSync(join(outDir, `${state.code}.geojson`), `${JSON.stringify(out)}\n`)
  }
  console.log(`Wrote ${lines.length} state outlines to ${outDir}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
