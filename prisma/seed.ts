import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const existing = await client.query("SELECT id FROM \"User\" WHERE email = $1", ["admin@tacc.vet"]);
  if (existing.rows.length > 0) {
    console.log("Admin user already exists");
    return;
  }

  const hashed = await bcrypt.hash("admin123", 10);
  const id = `seed_${Date.now()}`;
  await client.query(
    `INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [id, "admin@tacc.vet", "Admin", hashed, "admin"]
  );

  console.log("Created admin user: admin@tacc.vet (password: admin123)");
}

main()
  .then(() => client.end())
  .catch((e) => {
    console.error(e);
    client.end();
    process.exit(1);
  });
