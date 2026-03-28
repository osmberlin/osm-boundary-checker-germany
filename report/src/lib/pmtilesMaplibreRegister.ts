import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'

/** Keep the protocol instance alive for the lifetime of the app. */
const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)
