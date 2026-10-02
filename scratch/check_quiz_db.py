import psycopg2
import json

db_url = "postgresql://neondb_owner:npg_Y68QaMdyhWTO@ep-wandering-frog-b3qd20n7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT quiz_id, quiz_code, title, status, start_time, end_time FROM quizzes WHERE quiz_code IN ('924498', '931411', '887355', '820841') ORDER BY quiz_id DESC")
rows = cur.fetchall()
print("Quizzes found:")
for r in rows:
    print(r)
    cur.execute("SELECT registration_number FROM quiz_allowed_students WHERE quiz_id = %s", (r[0],))
    regs = cur.fetchall()
    print("  Allowed regs:", [x[0] for x in regs])

# Also check attempt status for 23BCE8830 on these quizzes
cur.execute("""
    SELECT qa.attempt_id, q.quiz_code, u.email, u.registration_no, qa.status, qa.started_at, qa.submitted_at
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.quiz_id
    JOIN users u ON qa.student_id = u.user_id
    WHERE u.registration_no LIKE '%8830%' OR u.email LIKE '%8830%'
    ORDER BY qa.attempt_id DESC
""")
attempts = cur.fetchall()
print("\nAttempts by 8830:")
for a in attempts:
    print(a)

conn.close()
