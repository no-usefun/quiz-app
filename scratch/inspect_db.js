const { Client } = require('pg');

const client = new Client({
  host: 'ep-wandering-frog-b3qd20n7-pooler.c-4.ap-southeast-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_Y68QaMdyhWTO',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  const qRes = await client.query("SELECT * FROM quizzes WHERE quiz_code = '608278'");
  console.log("Quiz 608278:", qRes.rows[0]);
  if (qRes.rows[0]) {
    const allowed = await client.query("SELECT * FROM quiz_allowed_students WHERE quiz_id = " + qRes.rows[0].id);
    console.log("Allowed students for quiz 608278:", allowed.rows);
  }
  const users = await client.query("SELECT id, first_name, last_name, email, role, registration_no FROM users ORDER BY id DESC LIMIT 15");
  console.log("Recent users in DB:", users.rows);
  await client.end();
}

check().catch(console.error);
