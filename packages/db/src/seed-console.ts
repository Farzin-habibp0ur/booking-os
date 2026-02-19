import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Platform Console data...');

  // Create or find platform business
  let platformBiz = await prisma.business.findFirst({
    where: { slug: 'platform' },
  });

  if (!platformBiz) {
    platformBiz = await prisma.business.create({
      data: {
        name: 'Booking OS Platform',
        slug: 'platform',
        verticalPack: 'general',
      },
    });
    console.log('Created platform business:', platformBiz.id);
  } else {
    console.log('Platform business already exists:', platformBiz.id);
  }

  // Create or find super admin staff
  let superAdmin = await prisma.staff.findFirst({
    where: { email: 'admin@bookingos.com' },
  });

  if (!superAdmin) {
    const passwordHash = await bcrypt.hash('superadmin123', 12);
    superAdmin = await prisma.staff.create({
      data: {
        name: 'Platform Admin',
        email: 'admin@bookingos.com',
        passwordHash,
        role: 'SUPER_ADMIN',
        businessId: platformBiz.id,
        emailVerified: true,
      },
    });
    console.log('Created super admin:', superAdmin.id);
  } else {
    console.log('Super admin already exists:', superAdmin.id);
  }

  console.log('Platform Console seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
