import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import * as schema from './schema/index';
import {
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
  DEMO_SOURCE_KEY,
  DEMO_SOURCE_NAME,
  LISTING_REVIEWER_USER_ID,
  ORG_AGENT_USER_ID,
  ORG_OWNER_USER_ID,
  ORG_VIEWER_USER_ID,
  PLATFORM_ADMIN_USER_ID,
  BUYER_DEMO_USER_ID,
} from './seed-constants';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for db:seed');
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const existingCountry = await db
    .select()
    .from(schema.countries)
    .where(eq(schema.countries.iso2, 'ES'))
    .limit(1);

  let countryId = existingCountry[0]?.id;
  if (!countryId) {
    const inserted = await db
      .insert(schema.countries)
      .values({ iso2: 'ES', nameEn: 'Spain', nameLocal: 'España' })
      .returning();
    countryId = inserted[0]!.id;
  }

  async function ensureCommunity(input: {
    nameEn: string;
    nameEs: string;
    nameCa?: string | null;
    code: string;
  }) {
    const found = await db
      .select()
      .from(schema.autonomousCommunities)
      .where(
        and(
          eq(schema.autonomousCommunities.countryId, countryId!),
          eq(schema.autonomousCommunities.nameEn, input.nameEn),
        ),
      )
      .limit(1);
    if (found[0]) return found[0];
    const [row] = await db
      .insert(schema.autonomousCommunities)
      .values({
        countryId: countryId!,
        nameEn: input.nameEn,
        nameEs: input.nameEs,
        nameCa: input.nameCa ?? null,
        code: input.code,
      })
      .returning();
    return row!;
  }

  const catalonia = await ensureCommunity({
    nameEn: 'Catalonia',
    nameEs: 'Cataluña',
    nameCa: 'Catalunya',
    code: 'CT',
  });
  const clm = await ensureCommunity({
    nameEn: 'Castilla-La Mancha',
    nameEs: 'Castilla-La Mancha',
    code: 'CM',
  });

  async function ensureProvince(communityId: string, name: string) {
    const found = await db
      .select()
      .from(schema.provinces)
      .where(
        and(
          eq(schema.provinces.autonomousCommunityId, communityId),
          eq(schema.provinces.nameEn, name),
        ),
      )
      .limit(1);
    if (found[0]) return found[0];
    const [row] = await db
      .insert(schema.provinces)
      .values({ autonomousCommunityId: communityId, nameEn: name, nameEs: name })
      .returning();
    return row!;
  }

  const barcelonaProvince = await ensureProvince(catalonia.id, 'Barcelona');
  for (const name of ['Girona', 'Lleida', 'Tarragona'] as const) {
    await ensureProvince(catalonia.id, name);
  }
  const albacete = await ensureProvince(clm.id, 'Albacete');

  async function ensureMunicipality(provinceId: string, nameEn: string, nameEs?: string) {
    const found = await db
      .select()
      .from(schema.municipalities)
      .where(
        and(
          eq(schema.municipalities.provinceId, provinceId),
          eq(schema.municipalities.nameEn, nameEn),
        ),
      )
      .limit(1);
    if (found[0]) return found[0];
    const [row] = await db
      .insert(schema.municipalities)
      .values({ provinceId, nameEn, nameEs: nameEs ?? nameEn })
      .returning();
    return row!;
  }

  const barcelonaCity = await ensureMunicipality(barcelonaProvince.id, 'Barcelona');
  await ensureMunicipality(barcelonaProvince.id, 'Sitges');
  await ensureMunicipality(barcelonaProvince.id, 'Gavà');
  const alcaraz = await ensureMunicipality(albacete.id, 'Alcaraz');
  void alcaraz;

  for (const name of ['Eixample', 'Sant Gervasi', 'Vallvidrera'] as const) {
    const found = await db
      .select()
      .from(schema.neighborhoods)
      .where(
        and(
          eq(schema.neighborhoods.municipalityId, barcelonaCity.id),
          eq(schema.neighborhoods.nameEn, name),
        ),
      )
      .limit(1);
    if (!found[0]) {
      await db.insert(schema.neighborhoods).values({
        municipalityId: barcelonaCity.id,
        nameEn: name,
        nameEs: name,
        nameCa: name,
      });
    }
  }

  for (const key of [
    'platform_admin',
    'listing_reviewer',
    'buyer',
    'org_owner',
    'org_agent',
    'org_viewer',
    'org_admin',
  ]) {
    const role = await db.select().from(schema.roles).where(eq(schema.roles.key, key)).limit(1);
    if (!role[0]) {
      await db.insert(schema.roles).values({ key });
    }
  }

  for (const type of [
    { key: 'apartment', labelEn: 'Apartment' },
    { key: 'penthouse', labelEn: 'Penthouse' },
    { key: 'villa', labelEn: 'Villa' },
    { key: 'detached_house', labelEn: 'Detached house' },
    { key: 'semi_detached_house', labelEn: 'Semi-detached house' },
    { key: 'townhouse', labelEn: 'Townhouse' },
  ] as const) {
    const found = await db
      .select()
      .from(schema.propertyTypes)
      .where(eq(schema.propertyTypes.key, type.key))
      .limit(1);
    if (!found[0]) {
      await db.insert(schema.propertyTypes).values(type);
    }
  }

  const source = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.sourceKey, 'legacy-barcelona-explorer-60'))
    .limit(1);
  if (!source[0]) {
    await db.insert(schema.dataSources).values({
      sourceKey: 'legacy-barcelona-explorer-60',
      name: 'Barcelona Property Explorer legacy snapshot',
      sourceType: 'legacy_snapshot',
      permissionStatus: 'restricted',
      imageRights: 'none',
      notes:
        'Snapshot/demo only. Not live inventory. Do not scrape portal URLs. No image republication rights.',
    });
  }

  // Phase 3 vertical slice — synthetic demo agency (D-P3-001: synthetic only until a named
  // partner confirms written permission).
  async function ensureUser(userId: string, displayName: string) {
    const found = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (found[0]) return found[0];
    const [row] = await db.insert(schema.users).values({ id: userId, displayName }).returning();
    return row!;
  }

  const orgOwnerUser = await ensureUser(ORG_OWNER_USER_ID, 'Demo Agency Owner');
  const orgAgentUser = await ensureUser(ORG_AGENT_USER_ID, 'Demo Agency Agent');
  const orgViewerUser = await ensureUser(ORG_VIEWER_USER_ID, 'Demo Agency Viewer');
  const platformAdminUser = await ensureUser(PLATFORM_ADMIN_USER_ID, 'Platform Admin (seed)');
  const listingReviewerUser = await ensureUser(LISTING_REVIEWER_USER_ID, 'Listing Reviewer (seed)');
  const buyerDemoUser = await ensureUser(BUYER_DEMO_USER_ID, 'Demo Buyer');

  const existingOrg = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, DEMO_ORG_ID))
    .limit(1);
  if (!existingOrg[0]) {
    await db.insert(schema.organizations).values({
      id: DEMO_ORG_ID,
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      type: 'agency',
      status: 'active',
    });
  }

  async function ensureMembership(userId: string, role: string) {
    const found = await db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, DEMO_ORG_ID),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!found[0]) {
      await db.insert(schema.organizationMembers).values({
        organizationId: DEMO_ORG_ID,
        userId,
        role,
      });
    }
  }
  await ensureMembership(orgOwnerUser.id, 'org_owner');
  await ensureMembership(orgAgentUser.id, 'org_agent');
  await ensureMembership(orgViewerUser.id, 'org_viewer');

  async function ensurePlatformRole(userId: string, roleKey: string) {
    const role = await db.select().from(schema.roles).where(eq(schema.roles.key, roleKey)).limit(1);
    if (!role[0]) return;
    const found = await db
      .select()
      .from(schema.userRoles)
      .where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.roleId, role[0].id)))
      .limit(1);
    if (!found[0]) {
      await db.insert(schema.userRoles).values({ userId, roleId: role[0].id });
    }
  }
  await ensurePlatformRole(platformAdminUser.id, 'platform_admin');
  await ensurePlatformRole(listingReviewerUser.id, 'listing_reviewer');
  await ensurePlatformRole(buyerDemoUser.id, 'buyer');

  const existingDemoSource = await db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.sourceKey, DEMO_SOURCE_KEY))
    .limit(1);
  let demoSourceId = existingDemoSource[0]?.id;
  if (!demoSourceId) {
    const [created] = await db
      .insert(schema.dataSources)
      .values({
        sourceKey: DEMO_SOURCE_KEY,
        name: DEMO_SOURCE_NAME,
        sourceType: 'csv',
        permissionStatus: 'approved',
        imageRights: 'none',
        organizationId: DEMO_ORG_ID,
        notes:
          'Synthetic demo agency for the Phase 3 vertical slice (D-P3-001). Not a real cooperating agency; production deployments must keep this pending until a named partner supplies written permission.',
      })
      .returning();
    demoSourceId = created!.id;

    await db.insert(schema.sourcePermissionEvents).values({
      dataSourceId: demoSourceId,
      actorUserId: null,
      fromStatus: null,
      toStatus: 'approved',
      fromImageRights: null,
      toImageRights: 'none',
      note: 'Seeded as approved for the Phase 3 vertical slice demo agency.',
    });
  }

  const existingFeedConfig = await db
    .select()
    .from(schema.feedConfigs)
    .where(eq(schema.feedConfigs.dataSourceId, demoSourceId))
    .limit(1);
  if (!existingFeedConfig[0]) {
    await db.insert(schema.feedConfigs).values({
      dataSourceId: demoSourceId,
      format: 'csv',
      isActive: true,
      mapping: {
        formatVersion: 'spain-partner-csv-v1',
        requiredColumns: ['external_id', 'title', 'price_eur', 'property_type', 'status'],
        optionalColumns: [
          'description',
          'currency',
          'bedrooms',
          'bathrooms',
          'built_area_sqm',
          'environment_type',
          'municipality',
          'neighborhood',
          'address_text',
          'lat',
          'lng',
          'location_accuracy',
          'source_updated_at',
          'image_urls',
          'features',
        ],
      },
    });
  }

  await client.end();
  console.log('Seed complete — Alcaraz under Castilla-La Mancha / Albacete (not Catalonia)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
