import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "hello@arhamkhnz.com" },
    update: {},
    create: {
      email: "hello@arhamkhnz.com",
      name: "Arham Khan",
      role: "administrator",
      password,
    },
  });

  await prisma.user.upsert({
    where: { email: "hello@ammarkhnz.com" },
    update: {},
    create: {
      email: "hello@ammarkhnz.com",
      name: "Ammar Khan",
      role: "admin",
      password,
    },
  });

  console.log("Seeded 2 users with password: password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
