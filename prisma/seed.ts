import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
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
}

main()
  .catch((error) => {
    console.error("Failed to seed ProcuraX:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
