import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import * as schema from './schema/index';

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

  for (const key of ['platform_admin', 'listing_reviewer', 'buyer', 'org_owner', 'org_agent']) {
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

  await client.end();
  console.log('Seed complete — Alcaraz under Castilla-La Mancha / Albacete (not Catalonia)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
