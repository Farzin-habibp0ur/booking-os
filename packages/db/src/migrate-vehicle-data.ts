/**
 * One-time migration script: extracts vehicle data from Customer.customFields
 * for dealership businesses and creates Vehicle records where VINs exist.
 *
 * Usage: npx tsx packages/db/src/migrate-vehicle-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting vehicle data migration...');

  // Find all dealership businesses
  const dealerships = await prisma.business.findMany({
    where: { verticalPack: 'dealership' },
    select: { id: true, name: true },
  });

  if (dealerships.length === 0) {
    console.log('No dealership businesses found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${dealerships.length} dealership(s)`);

  let created = 0;
  let skipped = 0;

  for (const biz of dealerships) {
    const prefix = (biz.name || 'VEH')
      .replace(/[^A-Z0-9]/gi, '')
      .substring(0, 3)
      .toUpperCase();

    // Get all customers with vehicle data in customFields
    const customers = await prisma.customer.findMany({
      where: {
        businessId: biz.id,
        deletedAt: null,
      },
      select: { id: true, customFields: true },
    });

    let seq = 1;

    // Check for existing vehicles to set the right sequence start
    const latestVehicle = await prisma.vehicle.findFirst({
      where: { businessId: biz.id, stockNumber: { startsWith: `${prefix}-` } },
      orderBy: { stockNumber: 'desc' },
      select: { stockNumber: true },
    });
    if (latestVehicle) {
      const lastSeq = parseInt(latestVehicle.stockNumber.replace(`${prefix}-`, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    for (const customer of customers) {
      const cf = customer.customFields as Record<string, any> | null;
      if (!cf || (!cf.make && !cf.model && !cf.vin)) {
        skipped++;
        continue;
      }

      const make = cf.make as string | undefined;
      const model = cf.model as string | undefined;
      const year = cf.year ? parseInt(cf.year, 10) : undefined;
      const vin = cf.vin ? String(cf.vin).toUpperCase().trim() : undefined;
      const mileage = cf.mileage ? parseInt(cf.mileage, 10) : undefined;

      if (!make || !model) {
        skipped++;
        continue;
      }

      // Skip if VIN already exists
      if (vin && vin.length === 17) {
        const existing = await prisma.vehicle.findUnique({ where: { vin } });
        if (existing) {
          console.log(`  Skipping duplicate VIN: ${vin}`);
          skipped++;
          continue;
        }
      }

      const stockNumber = `${prefix}-${String(seq++).padStart(5, '0')}`;
      const condition = cf.interestType === 'New' ? 'NEW' : 'USED';

      await prisma.vehicle.create({
        data: {
          businessId: biz.id,
          stockNumber,
          vin: vin && vin.length === 17 ? vin : undefined,
          year: year && year >= 1900 ? year : new Date().getFullYear(),
          make,
          model,
          mileage: mileage && mileage >= 0 ? mileage : undefined,
          condition,
          status: 'IN_STOCK',
        },
      });

      created++;
      console.log(`  Created vehicle: ${stockNumber} — ${year || '?'} ${make} ${model}`);
    }
  }

  console.log(`\nMigration complete: ${created} vehicles created, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
