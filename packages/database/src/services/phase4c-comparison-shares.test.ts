import { describe, expect, it } from 'vitest';
import { hashShareToken, mintShareToken, toPublicComparisonDto } from './phase4c-comparison-shares';

describe('Phase 4C comparison shares', () => {
  it('mints opaque tokens and hashes deterministically without retaining plaintext', () => {
    const token = mintShareToken();
    const hash = hashShareToken(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashShareToken(token)).toBe(hash);
  });

  it('maps only public allowlisted fields', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const listingId = '11111111-1111-4111-8111-111111111111';
    const share = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: 'private-user-id',
      comparisonSetId: null,
      tokenHash: 'secret-hash',
      publicTitle: 'Two homes',
      publicDescription: null,
      expiresAt: new Date('2026-08-13T12:00:00.000Z'),
      revokedAt: null,
      replacedByShareId: null,
      manifest: {
        schemaVersion: 'phase4c.v1',
        fields: ['title', 'location_precision', 'asking_price'],
        listingIds: [listingId],
        includeWeights: false,
        includeScores: false,
        scoreModelVersion: null,
        createdAt: now.toISOString(),
        expiresAt: '2026-08-13T12:00:00.000Z',
      },
      includeWeights: false,
      includeScores: false,
      scoreModelVersion: null,
      weightSnapshot: null,
      accessCount: 0,
      lastAccessedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const item = {
      id: '33333333-3333-4333-8333-333333333333',
      shareId: share.id,
      listingId,
      position: 0,
      physicalPropertyId: null,
    };
    const listing = {
      id: listingId,
      title: 'Public title',
      areaLabel: 'Sitges',
      addressText: 'Private exact address',
      priceAmount: '450000',
      pricePerSqm: null,
      bedrooms: 2,
      bathrooms: 1,
      builtAreaSqm: '80',
      environmentType: 'coastal',
      nearestTransit: null,
      commuteMin: null,
      beachProximity: null,
      parkProximity: null,
      operationalStatus: 'available',
      freshnessMethod: 'partner_feed',
      isPublicBrowseable: true,
      lastConfirmedAvailableAt: now,
      portalName: 'Partner',
      sourceUrl: 'https://example.test/listing',
      physicalPropertyId: null,
      notes: 'must never leak',
      buyerEmail: 'buyer@example.test',
      guestId: 'private-guest',
    };

    const dto = toPublicComparisonDto(share as never, [item] as never, [listing] as never);
    const serialized = JSON.stringify(dto);
    expect(dto.listings[0]?.cells).toEqual({
      title: { status: 'available', value: 'Public title' },
      asking_price: { status: 'available', value: 450000 },
      location_precision: { status: 'available', value: 'Sitges' },
    });
    for (const forbidden of [
      'addressText',
      'Private exact address',
      'notes',
      'must never leak',
      'buyerEmail',
      'buyer@example.test',
      'userId',
      'guestId',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
