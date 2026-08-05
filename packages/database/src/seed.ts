import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import * as schema from './schema/index';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('DATABASE_URL missing — seed skipped.');
    process.exit(0);
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

  for (const name of ['Barcelona', 'Girona', 'Lleida', 'Tarragona'] as const) {
    await ensureProvince(catalonia.id, name);
  }
  const albacete = await ensureProvince(clm.id, 'Albacete');

  const alcaraz = await db
    .select()
    .from(schema.municipalities)
    .where(
      and(
        eq(schema.municipalities.provinceId, albacete.id),
        eq(schema.municipalities.nameEn, 'Alcaraz'),
      ),
    )
    .limit(1);
  if (!alcaraz[0]) {
    await db.insert(schema.municipalities).values({
      provinceId: albacete.id,
      nameEn: 'Alcaraz',
      nameEs: 'Alcaraz',
    });
  }

  for (const key of ['platform_admin', 'listing_reviewer', 'buyer', 'org_owner', 'org_agent']) {
    const role = await db.select().from(schema.roles).where(eq(schema.roles.key, key)).limit(1);
    if (!role[0]) {
      await db.insert(schema.roles).values({ key });
    }
  }

  await client.end();
  console.log('Seed complete — Alcaraz under Castilla-La Mancha / Albacete (not Catalonia)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
