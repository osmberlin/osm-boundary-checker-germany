import { describe, expect, test } from 'vitest'
import { BKG_ZIP_URL } from '../../../scripts/shared/bkg.ts'
import {
  OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
  fallbackOfficialSourceGroupKey,
  normalizedOfficialDownloadUrl,
  officialLicenseTupleFingerprint,
  officialSourceGroupKey,
} from './officialSourceGroupKey.ts'

function profileCfg(
  profile: 'bkg_vg25_gem' | 'bkg_vg25_lan',
): Parameters<typeof officialSourceGroupKey>[0] {
  return {
    officialMode: 'profile',
    displayName: 'x',
    titlePrefix: 'x',
    officialProfile: profile,
    osmProfile: 'admin_rs',
    idNormalization: { preset: 'amtlicher-8' },
    metricsCrs: 'EPSG:4326',
    compare: {
      officialMatchProperty: 'ars',
      bboxFilter: 'none',
      osmScopeFilter: 'none',
      minZoom: 0,
    },
  }
}

function directCfg(): Parameters<typeof officialSourceGroupKey>[0] {
  return {
    officialMode: 'direct',
    displayName: 'x',
    titlePrefix: 'x',
    official: {},
    osmProfile: 'admin_rs',
    idNormalization: { preset: 'amtlicher-8' },
    metricsCrs: 'EPSG:4326',
    compare: {
      officialMatchProperty: 'ars',
      bboxFilter: 'none',
      osmScopeFilter: 'none',
      minZoom: 0,
    },
  }
}

describe('officialSourceGroupKey', () => {
  test('collapses BKG VG25 profiles to one canonical key', () => {
    expect(officialSourceGroupKey(profileCfg('bkg_vg25_gem'), undefined, 'de-gemeinden-bw')).toBe(
      OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
    )
    expect(officialSourceGroupKey(profileCfg('bkg_vg25_lan'), undefined, 'de-laender')).toBe(
      OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
    )
  })

  test('direct mode groups by normalized download URL', () => {
    const url = 'https://example.com/wfs?service=WFS&request=GetCapabilities'
    expect(officialSourceGroupKey(directCfg(), url, 'berlin-bezirke')).toBe(
      `download:${normalizedOfficialDownloadUrl(url)}`,
    )
  })

  test('direct mode BKG VG25 ZIP or WFS maps to same key as profile preset family', () => {
    expect(officialSourceGroupKey(directCfg(), BKG_ZIP_URL, 'de-gemeinden-bw')).toBe(
      OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
    )
    const wfs =
      'https://sgx.geodatenzentrum.de/wfs_vg25?service=WFS&request=GetFeature&typeNames=vg25_gem'
    expect(officialSourceGroupKey(directCfg(), wfs, 'de-gemeinden-x')).toBe(
      OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
    )
  })

  test('direct mode missing URL uses per-area key', () => {
    expect(officialSourceGroupKey(directCfg(), undefined, 'area-a')).toBe('download:missing:area-a')
  })

  test('fallback uses download href or area slug', () => {
    expect(fallbackOfficialSourceGroupKey('https://x.test/foo', 'ignored')).toBe(
      'download:https://x.test/foo',
    )
    expect(fallbackOfficialSourceGroupKey(BKG_ZIP_URL, 'ignored')).toBe(
      OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
    )
    expect(fallbackOfficialSourceGroupKey(undefined, 'only-area')).toBe('fallback:only-area')
  })

  test('license fingerprint distinguishes licence tuples', () => {
    const a = officialLicenseTupleFingerprint({
      officialLicenseLabel: 'CC-BY-4.0',
      officialOsmCompatibility: 'unknown',
    })
    const b = officialLicenseTupleFingerprint({
      officialLicenseLabel: 'CC-BY-4.0',
      officialOsmCompatibility: 'no',
    })
    expect(a).not.toBe(b)
  })
})
