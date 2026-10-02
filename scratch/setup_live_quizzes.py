import psycopg2
import time
import json
import urllib.request

db_url = "postgresql://neondb_owner:npg_Y68QaMdyhWTO@ep-wandering-frog-b3qd20n7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# 1. Whitelist 23BCE8830 and 23BCE8878 on 924498
cur.execute("SELECT quiz_id FROM quizzes WHERE quiz_code = '924498'")
q_row = cur.fetchone()
if q_row:
    quiz_id_924498 = q_row[0]
    for reg in ['23BCE8830', '23BCE8878']:
        cur.execute("INSERT INTO quiz_allowed_students (quiz_id, registration_number) VALUES (%s, %s) ON CONFLICT DO NOTHING", (quiz_id_924498, reg))
    # Clear any previous attempts for 23BCE8830 on 924498
    cur.execute("DELETE FROM student_selected_options WHERE answer_id IN (SELECT answer_id FROM student_answers WHERE attempt_id IN (SELECT attempt_id FROM quiz_attempts WHERE quiz_id = %s))", (quiz_id_924498,))
    cur.execute("DELETE FROM student_answers WHERE attempt_id IN (SELECT attempt_id FROM quiz_attempts WHERE quiz_id = %s)", (quiz_id_924498,))
    cur.execute("DELETE FROM activity_logs WHERE attempt_id IN (SELECT attempt_id FROM quiz_attempts WHERE quiz_id = %s)", (quiz_id_924498,))
    cur.execute("DELETE FROM devices WHERE attempt_id IN (SELECT attempt_id FROM quiz_attempts WHERE quiz_id = %s)", (quiz_id_924498,))
    cur.execute("DELETE FROM quiz_attempts WHERE quiz_id = %s", (quiz_id_924498,))
    conn.commit()
    print("[OK] Quiz 924498 whitelist updated with 23BCE8830 and 23BCE8878, previous attempts cleared!")

# 2. Also create a brand new dedicated quiz via API
BASE_URL = "http://localhost:8080"
def request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

# Teacher login
login_res = request("POST", "/api/v1/auth/login", {
    "email": "teacher@dynoquizz.edu",
    "password": "Password123!"
})
teacher_token = login_res.get("data", {}).get("token") or login_res.get("token")

now_str = time.strftime("%Y-%m-%dT%H:%M:%S")
end_str = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() + 14400))

new_quiz = request("POST", "/api/v1/teacher/quizzes", {
    "title": "Computer Science AI Proctored Midterm 2026",
    "description": "Exclusive live examination session for registered candidates.",
    "instructions": "Full-screen lockdown and AI gaze proctoring are strictly enforced.",
    "subject": "Data Structures & Algorithms",
    "subjectCode": "CSE-302",
    "totalStudents": 2,
    "overallTimerSeconds": 3600,
    "negativeMarking": True,
    "negativeMarks": 0.25,
    "timeBonusEnabled": False,
    "randomQuestionOrder": False,
    "randomOptionOrder": False,
    "allowReview": True,
    "allowResume": True,
    "autoSubmit": True,
    "startTime": now_str,
    "endTime": end_str,
    "resultVisibility": "BOTH",
    "acceptedEmailDomain": None,
    "allowedRegistrationNumbers": ["23BCE8830", "23BCE8878"],
    "questions": [
        {
            "questionText": "What is the worst-case time complexity of binary search on a sorted array of size N?",
            "imageUrl": "",
            "explanation": "Binary search divides the search interval in half with each comparison, taking O(log N).",
            "questionType": "MCQ",
            "marks": 4,
            "negativeMarks": 1,
            "questionTimerSeconds": 120,
            "difficulty": "EASY",
            "displayOrder": 1,
            "options": [
                {"optionText": "O(log N)", "optionImage": "", "optionOrder": 1, "isCorrect": True},
                {"optionText": "O(N)", "optionImage": "", "optionOrder": 2, "isCorrect": False},
                {"optionText": "O(N log N)", "optionImage": "", "optionOrder": 3, "isCorrect": False},
                {"optionText": "O(1)", "optionImage": "", "optionOrder": 4, "isCorrect": False}
            ]
        },
        {
            "questionText": "Which data structure follows the Last-In, First-Out (LIFO) principle?",
            "imageUrl": "",
            "explanation": "A Stack operates strictly under the LIFO principle.",
            "questionType": "MCQ",
            "marks": 4,
            "negativeMarks": 1,
            "questionTimerSeconds": 120,
            "difficulty": "EASY",
            "displayOrder": 2,
            "options": [
                {"optionText": "Stack", "optionImage": "", "optionOrder": 1, "isCorrect": True},
                {"optionText": "Queue", "optionImage": "", "optionOrder": 2, "isCorrect": False},
                {"optionText": "Linked List", "optionImage": "", "optionOrder": 3, "isCorrect": False},
                {"optionText": "Binary Tree", "optionImage": "", "optionOrder": 4, "isCorrect": False}
            ]
        }
    ]
}, teacher_token)

new_quiz_id = new_quiz.get("data", {}).get("quizId") or new_quiz.get("quizId")
new_quiz_code = new_quiz.get("data", {}).get("quizCode") or new_quiz.get("quizCode")

# Publish it
request("PUT", f"/api/v1/teacher/quizzes/{new_quiz_id}/publish", None, teacher_token)
print(f"[OK] New Live Quiz Created & Published! Code: {new_quiz_code}, ID: {new_quiz_id}")

conn.close()
