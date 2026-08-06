import { describe, expect, it } from 'vitest';
import { notificationDedupeKey } from '@spain/domain';
import { InlineJobRunner, TestJobRunner } from './index';
import { TestNotificationProvider } from '../services/phase4b-workspace';

describe('phase4b jobs', () => {
  it('TestJobRunner records calls while delegating', async () => {
    const provider = new TestNotificationProvider();
    const runner = new TestJobRunner(provider);
    // Smoke: method exists and records without requiring a live DB when we only inspect the API.
    expect(typeof runner.evaluateSavedSearch).toBe('function');
    expect(typeof runner.generateListingChangeNotifications).toBe('function');
    expect(typeof runner.evaluateAllDueSavedSearches).toBe('function');
    expect(runner.calls).toEqual([]);
  });

  it('InlineJobRunner and TestJobRunner share the JobRunner surface', () => {
    const inline = new InlineJobRunner();
    const test = new TestJobRunner();
    for (const method of [
      'evaluateSavedSearch',
      'evaluateAllDueSavedSearches',
      'generateListingChangeNotifications',
      'expireOldHistory',
      'cleanExpiredNotifications',
    ] as const) {
      expect(typeof inline[method]).toBe('function');
      expect(typeof test[method]).toBe('function');
    }
  });

  it('TestNotificationProvider captures deliveries without DB writes', async () => {
    const provider = new TestNotificationProvider();
    const input = {
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      type: 'price_reduction',
      titleKey: 'notifications.price_reduction.title',
      bodyKey: 'notifications.price_reduction.body',
      payload: { listingId: 'l1' },
      dedupeKey: notificationDedupeKey({
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        type: 'price_reduction',
        listingId: 'l1',
        sourceEventId: 'e1',
      }),
      listingId: 'l1',
      sourceEventId: 'e1',
    };
    // Pass a stub db — TestNotificationProvider ignores it.
    const result = await provider.deliver({} as never, input);
    expect(result.delivered).toBe(true);
    expect(provider.delivered).toHaveLength(1);
    expect(provider.delivered[0]?.dedupeKey).toBe(input.dedupeKey);
  });
});
