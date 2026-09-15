import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@bordomavi.com';
  const password = '93b2e49b42b6171e';
  
  const hashedPassword = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name: 'Yönetici',
      role: 'ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Yönetici',
      role: 'ADMIN',
    },
  });

  console.log('Admin user created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });