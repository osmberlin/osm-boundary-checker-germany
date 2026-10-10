import { addProtocol, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Protocol } from 'pmtiles'

// MapLibre 6 loads its worker as a separate file; Vite does not emit it, so point at a bundled copy.
setWorkerUrl(workerUrl)

/** Keep the protocol instance alive for the lifetime of the app. */
const protocol = new Protocol()
addProtocol('pmtiles', protocol.tile)
