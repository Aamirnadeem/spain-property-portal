import { assertAuthRuntimeSafety, readAuthRuntimeConfig } from '@spain/communications';

/**
 * Runs when the Next.js server starts. Invalid production auth configuration
 * prevents the application from accepting traffic.
 */
export async function register(): Promise<void> {
  assertAuthRuntimeSafety(readAuthRuntimeConfig());
}
