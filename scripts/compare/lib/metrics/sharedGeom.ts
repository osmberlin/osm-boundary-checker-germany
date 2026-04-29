import type { Geometry, MultiPolygon, Polygon } from 'geojson'
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js'
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js'

const geoReader = new GeoJSONReader(new GeometryFactory())

export function isPoly(g: Geometry): g is Polygon | MultiPolygon {
  return g.type === 'Polygon' || g.type === 'MultiPolygon'
}

export function jstsAreaM2(g: Geometry): number {
  const geom = geoReader.read(g) as { getArea: () => number }
  return geom.getArea()
}

export function jstsBoundaryLengthM(g: Geometry): number {
  const geom = geoReader.read(g) as { getBoundary: () => { getLength: () => number } }
  return geom.getBoundary().getLength()
}

export { geoReader }
