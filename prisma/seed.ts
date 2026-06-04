import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Department list ────────────────────────────────────────────────────────
const DEPARTMENT_NAMES = [
  "B2B Sales",
  "Video Editing",
  "B2C Operations",
  "MMT",
  "Accounts",
  "Online Sales",
  "Image Editing",
  "Marketing",
  "B2B Operations",
  "Editing",
  "Tech",
  "Social Media",
  "Photography Manager",
  "Operations",
  "Sourcing",
  "General",
];

// ─── User definitions ────────────────────────────────────────────────────────
// username  = password prefix (part before @)
// password  = exact value shown in the data
// role      = ADMIN | USER
// status    = ACTIVE | INACTIVE
// email     = null when duplicate across users (db has UNIQUE constraint)
// dept      = department name (null if unassigned → mapped to "General")

interface UserDef {
  username: string;
  password: string;
  role: "ADMIN" | "USER";
  status?: "ACTIVE" | "INACTIVE";
  email?: string;
  dept: string;
}

const USERS: UserDef[] = [
  { username: "Imtiyaz",     password: "Imtiyaz@2026",    role: "USER",  email: "Imageeditorvsnapu@gmail.com", dept: "B2B Sales" },
  { username: "Disha",       password: "Disha@2026",       role: "USER",                                         dept: "Video Editing" },
  { username: "MDOffice",    password: "admin@2026",       role: "ADMIN", email: "pc@vsnapu.com",               dept: "B2C Operations" },
  { username: "Deepali",     password: "Deepali@2026",     role: "USER",  email: "Vsnapupolitical@gmail.com",    dept: "MMT" },
  { username: "Amar",        password: "Amar@2026",        role: "ADMIN", email: "political@vsnapu.com",         dept: "Accounts" },
  { username: "Vishal",      password: "Vishal@2026",      role: "ADMIN", email: "vishal@vsnapu.com",            dept: "Online Sales" },
  { username: "Mayank",      password: "Mayank@2026",      role: "USER",                                         dept: "Image Editing" },
  { username: "Tanzeem",     password: "Tanzeem@2026",     role: "ADMIN", email: "tanzeem@vsnapu.com",           dept: "Marketing" },
  { username: "Angelo",      password: "Angelo@2026",      role: "USER",  email: "angelo@vsnapu.com",            dept: "B2B Operations" },
  { username: "Sujoy",       password: "Sujoy@2026",       role: "USER",                                         dept: "Editing" },
  { username: "Shubham",     password: "Shubham@2026",     role: "ADMIN", email: "salesmanager@vsnapu.com",      dept: "Tech" },
  { username: "AmanRaj",     password: "AmanRaj@2026",     role: "USER",  email: "Videoeditor.vsnapu@gmail.com", dept: "Social Media" },
  { username: "Prithwish",   password: "Prithwish@2026",   role: "USER",  email: "operations@vsnapu.com",        dept: "Photography Manager" },
  { username: "Goutam",      password: "Goutam@2026",      role: "USER",  email: "kiran@vsnapu.com",             dept: "Operations" },
  { username: "Sohail",      password: "Sohail@2026",      role: "USER",  email: "resortsales.vsnapu@gmail.com", dept: "Sourcing" },
  // ── No-department users ───────────────────────────────────────────────────
  { username: "Tanisha",     password: "Tanisha@2026",     role: "USER",                                         dept: "General" },
  { username: "Armaan",      password: "Armaan@2026",      role: "USER",                                         dept: "General" },
  { username: "Mugaut",      password: "Mugaut@2026",      role: "USER",                                         dept: "General" },
  { username: "Vishwajeet",  password: "Vishwajeet@2026",  role: "USER",  email: "photographersvsnapu@gmail.com",dept: "General" },
  { username: "Altamash",    password: "Altamash@2026",    role: "USER",                                         dept: "General" },
  { username: "Neeraj",      password: "Neeraj@2026",      role: "USER",  email: "nirajvsnapu@gmail.com",        dept: "General" },
  { username: "Minroy",      password: "Minroy@2026",      role: "USER",                                         dept: "General" },
  { username: "Niyaz",       password: "Niyaz@2026",       role: "USER",                                         dept: "General" },
  { username: "Apoorva",     password: "Apoorva@2026",     role: "USER",  email: "photographer.admin@vsnapu.com",dept: "General" },
  { username: "Abhishek",    password: "Abhishek@2027",    role: "USER",                                         dept: "General" },
  { username: "Gaurav",      password: "Gaurav@2026",      role: "USER",                                         dept: "General" },
  { username: "Vartika",     password: "Vartika@2026",     role: "USER",  email: "vartikamishra141@gmail.com",   dept: "General" },
  { username: "Aditya",      password: "Aditya@2026",      role: "USER",                                         dept: "General" },
  { username: "Lucky",       password: "Lucky@2026",       role: "USER",  email: "lucky.vsnapu20@gmail.com",     dept: "General" },
  { username: "Shray",       password: "Shray@2026",       role: "USER",                                         dept: "General" },
  { username: "Rahbar",      password: "Rahbar@2026",      role: "USER",                                         dept: "General" },
  { username: "Sanjay",      password: "Sanjay@2026",      role: "USER",                                         dept: "General" },
  { username: "Rohit",       password: "Rohit@2026",       role: "USER",                                         dept: "General" },
  { username: "Rohan",       password: "Rohan@2027",       role: "USER",  email: "rohanvsnapu@gmail.com",        dept: "General" },
  { username: "Diwakar",     password: "Diwakar@2026",     role: "USER",                                         dept: "General" },
  { username: "Mona",        password: "Mona@2026",        role: "USER",  email: "monikavsnapu20@gmail.com",     dept: "General" },
  { username: "NirajMandal", password: "NirajMandal@2026", role: "USER",                                         dept: "General" },
  { username: "Parth",       password: "Parth@2026",       role: "USER",  email: "b2b.operations@vsnapu.com",    dept: "General", status: "INACTIVE" },
  { username: "Vinay",       password: "Vinay@3445",       role: "USER",  email: "vinay@vsnapu.com",             dept: "General" },
  { username: "Lakshya",     password: "Lakshya@3256",     role: "USER",                                         dept: "General" },
  { username: "Muskan",      password: "Muskan@4567",      role: "USER",                                         dept: "General" },
  { username: "Karthik",     password: "Karthik@2026",     role: "USER",                                         dept: "General" },
  { username: "Vipin",       password: "Vipin@123",        role: "USER",                                         dept: "General" },
  { username: "Mahesh",      password: "Mahesh@7890",      role: "USER",                                         dept: "General" },
  { username: "Aditi",       password: "Aditi@2606",       role: "USER",                                         dept: "General" },
  { username: "Sharad",      password: "Sharad@098",       role: "USER",  email: "sharad@vsnapu.com",            dept: "General" },
  { username: "Vaibhavi",    password: "Vaibhavi@487",     role: "USER",  email: "Operationsvsnapu@gmail.com",   dept: "General" },
  { username: "Taran",       password: "Taran@2026",       role: "ADMIN", email: "taranbir@vsnapu.com",          dept: "General" },
  { username: "Shruti",      password: "Shruti@567",       role: "USER",  email: "shruti@vsnapu.com",            dept: "General" },
  { username: "Ashish",      password: "Ashish@2026",      role: "ADMIN", email: "ashish@vsnapu.com",            dept: "General" },
  { username: "Saurabh",     password: "Saurabh@8567",     role: "USER",  email: "saurabhvsnapu@gmail.com",      dept: "General" },
  { username: "Deniyal",     password: "Deniyal@2026",     role: "USER",                                         dept: "General" },
  { username: "Deepika",     password: "Deepika@2026",     role: "USER",  email: "deepika@vsnapu.com",           dept: "General" },
  { username: "Bipin",       password: "Bipin@2026",       role: "USER",                                         dept: "General" },
  { username: "Aman",        password: "Aman@2026",        role: "USER",                                         dept: "General" },
  { username: "KiranNayak",  password: "KiranNayak@2026",  role: "USER",                                         dept: "General" },
  { username: "Roop",        password: "Roop@2026",        role: "USER",  email: "roopkamalk225@gmail.com",      dept: "General" },
  { username: "Anish",       password: "Anish@2007",       role: "USER",  email: "accounts@vsnapu.com",          dept: "Accounts" },
  { username: "Chetan",      password: "Chetan@2026",      role: "USER",  email: "chetansraj123@gmail.com",      dept: "General" },
  { username: "Tushar",      password: "Tushar@2026",      role: "USER",                                         dept: "General" },
  { username: "Sarvesh",     password: "Sarvesh@624",      role: "USER",                                         dept: "General" },
  { username: "Hitesh",      password: "Hitesh@0823",      role: "USER",                                         dept: "General" },
  { username: "Navya",       password: "Navya@016",        role: "USER",                                         dept: "General" },
  { username: "Vaibhav",     password: "Vaibhav@2026",     role: "USER",                                         dept: "General" },
  { username: "Tamojit",     password: "Tamojit@2026",     role: "USER",                                         dept: "General" },
  { username: "Sagar",       password: "Sagar@2026",       role: "USER",                                         dept: "General" },
  { username: "Akash",       password: "Akash@2026",       role: "USER",                                         dept: "General" },
  { username: "Harish",      password: "Harish@2026",      role: "USER",                                         dept: "General" },
  { username: "Dhruv",       password: "Dhruv@2026",       role: "USER",  email: "dhruvjaiswal8006@gmail.com",   dept: "General" },
  { username: "Paras",       password: "Paras@2026",       role: "USER",                                         dept: "General" },
  { username: "Roshan",      password: "Roshan@2026",      role: "USER",  email: "rsrai0123@gmail.com",          dept: "General" },
  { username: "SanjayManas", password: "Sanjay@2026",      role: "USER",                                         dept: "General" },
  { username: "Kin",         password: "Kin@2026",         role: "USER",                                         dept: "General" },
  { username: "Sarthak",     password: "Sarthak@2026",     role: "USER",  email: "sarthak1110@gmail.com",        dept: "General" },
];

// ─── Holidays from working-day calendar ────────────────────────────────────
const HOLIDAYS = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-03-21", name: "Eid-ul-Fitr" },
  { date: "2026-05-28", name: "Eid-ul-Adha" },
  { date: "2026-06-26", name: "Muharram" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-08-28", name: "Raksha Bandhan" },
  { date: "2026-09-04", name: "Janmashtami" },
  { date: "2026-09-14", name: "Ganesh Chaturthi" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-12-25", name: "Christmas" },
];

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Departments ──────────────────────────────────────────────────────────
  console.log("Creating departments...");
  const deptMap: Record<string, number> = {};

  for (const name of DEPARTMENT_NAMES) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name, givenBy: "Admin" },
    });
    deptMap[name] = dept.id;
  }
  console.log(`✓ ${DEPARTMENT_NAMES.length} departments ready\n`);

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log("Creating users...");
  let created = 0;
  let skipped = 0;

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const deptId = deptMap[u.dept] ?? deptMap["General"];

    try {
      await prisma.user.upsert({
        where: { username: u.username },
        update: {
          passwordHash: hash,
          role: u.role,
          status: u.status ?? "ACTIVE",
          departmentId: deptId,
          ...(u.email ? { email: u.email } : {}),
        },
        create: {
          username: u.username,
          passwordHash: hash,
          email: u.email ?? null,
          role: u.role,
          status: u.status ?? "ACTIVE",
          departmentId: deptId,
        },
      });
      created++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Email uniqueness conflict — retry without email
      if (msg.includes("Unique constraint") && msg.includes("email")) {
        await prisma.user.upsert({
          where: { username: u.username },
          update: {
            passwordHash: hash,
            role: u.role,
            status: u.status ?? "ACTIVE",
            departmentId: deptId,
          },
          create: {
            username: u.username,
            passwordHash: hash,
            email: null,
            role: u.role,
            status: u.status ?? "ACTIVE",
            departmentId: deptId,
          },
        });
        skipped++;
        console.log(`  ⚠ ${u.username}: email conflict — stored without email`);
      } else {
        console.error(`  ✗ ${u.username}: ${msg}`);
      }
    }
  }

  console.log(`✓ ${created} users created/updated, ${skipped} email conflicts resolved\n`);

  // ── Holidays ──────────────────────────────────────────────────────────────
  console.log("Seeding holidays...");
  for (const h of HOLIDAYS) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: { name: h.name },
      create: { date: new Date(h.date), name: h.name },
    });
  }
  console.log(`✓ ${HOLIDAYS.length} holidays seeded\n`);

  // ── Sample task template ──────────────────────────────────────────────────
  const amar = await prisma.user.findUnique({ where: { username: "Amar" } });
  const disha = await prisma.user.findUnique({ where: { username: "Disha" } });

  if (amar && disha) {
    await prisma.taskTemplate.upsert({
      where: { taskCode: "T001" },
      update: {},
      create: {
        taskCode: "T001",
        departmentId: deptMap["Accounts"],
        givenBy: "Amar",
        assignedUserId: disha.id,
        description: "Daily video editing report upload",
        startDate: new Date(),
        frequency: "DAILY",
        enableReminders: true,
        requireAttachment: false,
      },
    });
    console.log("✓ Sample task template created\n");
  }

  // ── Print credentials table ──────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  LOGIN CREDENTIALS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Username          Password              Role");
  console.log("  ─────────────────────────────────────────────────────────────");
  for (const u of USERS) {
    const status = u.status === "INACTIVE" ? " [INACTIVE]" : "";
    console.log(`  ${u.username.padEnd(18)}${u.password.padEnd(22)}${u.role}${status}`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
