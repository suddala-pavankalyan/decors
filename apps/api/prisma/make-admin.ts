import { PrismaClient } from '@prisma/client';

// Usage: npm run make-admin -w apps/api -- you@example.com   (add --remove to demote)
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const demote = process.argv.includes('--remove');
  if (!email || email.startsWith('--')) {
    console.error('Usage: npm run make-admin -w apps/api -- you@example.com [--remove]');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}. Sign up on the website first, then run this again.`);
    process.exit(1);
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: demote ? 'USER' : 'ADMIN' } });
  console.log(`${email} is now ${demote ? 'a regular user' : 'an admin'}.`);
}

main().finally(() => prisma.$disconnect());
