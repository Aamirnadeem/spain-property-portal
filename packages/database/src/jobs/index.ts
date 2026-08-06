import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index';
import {
  InAppNotificationProvider,
  cleanExpiredNotifications,
  evaluateAllDueSavedSearches,
  evaluateSavedSearch,
  expireOldHistory,
  generateListingChangeNotifications,
  type ListingChangeEvent,
  type NotificationProvider,
  type SavedSearchEvaluationResult,
} from '../services/phase4b-workspace';

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Provider-neutral job execution boundary (ADR-027 / D14). 4B ships only `InlineJobRunner` and
 * `TestJobRunner` — no pg-boss/Inngest/Trigger.dev. `evaluateAllDueSavedSearches` is the
 * scheduler seam a future durable scheduler can call without changing method signatures.
 */
export interface JobRunner {
  evaluateSavedSearch(
    db: Db,
    userId: string,
    savedSearchId: string,
    trigger: 'manual' | 'test',
  ): Promise<SavedSearchEvaluationResult>;
  evaluateAllDueSavedSearches(db: Db): Promise<{ evaluated: number }>;
  generateListingChangeNotifications(
    db: Db,
    event: ListingChangeEvent,
  ): Promise<{ notified: number }>;
  expireOldHistory(db: Db, options?: { userId?: string; retentionDays?: number }): Promise<number>;
  cleanExpiredNotifications(db: Db, options?: { retentionDays?: number }): Promise<number>;
}

export class InlineJobRunner implements JobRunner {
  constructor(
    protected readonly provider: NotificationProvider = new InAppNotificationProvider(),
  ) {}

  async evaluateSavedSearch(
    db: Db,
    userId: string,
    savedSearchId: string,
    trigger: 'manual' | 'test',
  ): Promise<SavedSearchEvaluationResult> {
    return evaluateSavedSearch(db, userId, savedSearchId, trigger, this.provider);
  }

  async evaluateAllDueSavedSearches(db: Db): Promise<{ evaluated: number }> {
    return evaluateAllDueSavedSearches(db, this.provider);
  }

  async generateListingChangeNotifications(
    db: Db,
    event: ListingChangeEvent,
  ): Promise<{ notified: number }> {
    return generateListingChangeNotifications(db, event, this.provider);
  }

  async expireOldHistory(
    db: Db,
    options?: { userId?: string; retentionDays?: number },
  ): Promise<number> {
    return expireOldHistory(db, options);
  }

  async cleanExpiredNotifications(db: Db, options?: { retentionDays?: number }): Promise<number> {
    return cleanExpiredNotifications(db, options);
  }
}

export interface JobRunnerCall {
  method: keyof JobRunner;
  args: unknown[];
}

/** Records every call for test assertions while still delegating to the real inline behaviour. */
export class TestJobRunner extends InlineJobRunner {
  calls: JobRunnerCall[] = [];

  override async evaluateSavedSearch(
    db: Db,
    userId: string,
    savedSearchId: string,
    trigger: 'manual' | 'test',
  ): Promise<SavedSearchEvaluationResult> {
    this.calls.push({ method: 'evaluateSavedSearch', args: [userId, savedSearchId, trigger] });
    return super.evaluateSavedSearch(db, userId, savedSearchId, trigger);
  }

  override async evaluateAllDueSavedSearches(db: Db): Promise<{ evaluated: number }> {
    this.calls.push({ method: 'evaluateAllDueSavedSearches', args: [] });
    return super.evaluateAllDueSavedSearches(db);
  }

  override async generateListingChangeNotifications(
    db: Db,
    event: ListingChangeEvent,
  ): Promise<{ notified: number }> {
    this.calls.push({ method: 'generateListingChangeNotifications', args: [event] });
    return super.generateListingChangeNotifications(db, event);
  }

  override async expireOldHistory(
    db: Db,
    options?: { userId?: string; retentionDays?: number },
  ): Promise<number> {
    this.calls.push({ method: 'expireOldHistory', args: [options] });
    return super.expireOldHistory(db, options);
  }

  override async cleanExpiredNotifications(
    db: Db,
    options?: { retentionDays?: number },
  ): Promise<number> {
    this.calls.push({ method: 'cleanExpiredNotifications', args: [options] });
    return super.cleanExpiredNotifications(db, options);
  }
}
