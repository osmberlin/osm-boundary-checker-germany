import type { Geometry, Position } from 'geojson'
import proj4 from 'proj4'

const WGS84 = 'EPSG:4326'

function defineIfNeeded(code: string) {
  if (code === 'EPSG:32633') {
    proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs')
  }
  if (code === 'EPSG:25832') {
    // ETRS89 / UTM zone 32N (Germany-wide metric CRS for boundary metrics)
    proj4.defs(
      'EPSG:25832',
      '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    )
  }
}

function transformPosition(from: string, to: string, pos: Position): Position {
  const x = pos[0]
  const y = pos[1]
  if (x === undefined || y === undefined) {
    throw new Error('Position must include at least two coordinates')
  }
  const [tx, ty] = proj4(from, to, [x, y])
  const z = pos[2]
  return z !== undefined ? [tx, ty, z] : [tx, ty]
}

export function projectGeometry(geom: Geometry, toCrs: string): Geometry {
  defineIfNeeded(toCrs)
  const projectRing = (ring: Position[]): Position[] =>
    ring.map((p) => transformPosition(WGS84, toCrs, p))

  switch (geom.type) {
    case 'Point':
      return {
        type: 'Point',
        coordinates: transformPosition(WGS84, toCrs, geom.coordinates),
      }
    case 'LineString':
      return {
        type: 'LineString',
        coordinates: projectRing(geom.coordinates),
      }
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: geom.coordinates.map(projectRing),
      }
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: geom.coordinates.map(projectRing),
      }
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: geom.coordinates.map((poly) => poly.map(projectRing)),
      }
    default:
      return geom
  }
}
