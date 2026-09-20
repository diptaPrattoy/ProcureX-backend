import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed ProcuraX");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    name: "IT & Electronics",
    slug: "it-electronics",
    description: "Computers, networking, peripherals, electronics and related technology procurement.",
  },
  {
    name: "Office Supplies",
    slug: "office-supplies",
    description: "Stationery, furniture, consumables and general workplace supplies.",
  },
  {
    name: "Industrial Equipment",
    slug: "industrial-equipment",
    description: "Machinery, tools, production equipment and industrial components.",
  },
  {
    name: "Professional Services",
    slug: "professional-services",
    description: "Consulting, software, legal, accounting, design and other professional services.",
  },
  {
    name: "Facility & Maintenance",
    slug: "facility-maintenance",
    description: "Facility operations, repair, cleaning, maintenance and related services.",
  },
  {
    name: "Logistics & Transportation",
    slug: "logistics-transportation",
    description: "Freight, courier, warehousing, fleet and transportation services.",
  },
  {
    name: "Construction Materials",
    slug: "construction-materials",
    description: "Building materials, fixtures, hardware and construction supplies.",
  },
  {
    name: "Medical & Lab Supplies",
    slug: "medical-lab-supplies",
    description: "Medical devices, laboratory equipment, consumables and healthcare supplies.",
  },
] as const;

const seedAdmin = async () => {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email && !password) {
    console.log("Skipped ADMIN seed because SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD are not configured.");
    return;
  }

  if (!email || !password) {
    throw new Error("Both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required to seed an ADMIN");
  }

  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== "ADMIN") {
    throw new Error(`Cannot seed ADMIN: ${email} already belongs to a ${existing.role} account`);
  }

  const passwordHash = await hash(password, 12);
  const firstName = process.env.SEED_ADMIN_FIRST_NAME?.trim() || "ProcuraX";
  const lastName = process.env.SEED_ADMIN_LAST_NAME?.trim() || "Admin";

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: existing?.emailVerifiedAt ?? new Date(),
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Seeded ADMIN account: ${email}`);
};

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
        deletedAt: null,
      },
      create: category,
    });
  }

  console.log(`Seeded ${categories.length} procurement categories.`);
  await seedAdmin();
}

main()
  .catch((error) => {
    console.error("Failed to seed ProcuraX:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
