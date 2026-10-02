import sys
import time
import json
import urllib.request
import urllib.error

import psycopg2

BASE_URL = "http://localhost:8080"
DB_CONFIG = {
    "host": "ep-wandering-frog-b3qd20n7-pooler.c-4.ap-southeast-1.aws.neon.tech",
    "port": 5432,
    "dbname": "neondb",
    "user": "neondb_owner",
    "password": "npg_Y68QaMdyhWTO",
    "sslmode": "require"
}

def verify_email_in_db(email):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_verified = TRUE WHERE email = %s", (email.lower(),))
    conn.commit()
    cur.close()
    conn.close()

def request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            status = response.status
            try:
                parsed = json.loads(res_body)
            except Exception:
                parsed = res_body
            return {"status": status, "data": parsed, "error": None}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return {"status": e.code, "data": parsed, "error": str(e)}
    except Exception as e:
        return {"status": 500, "data": None, "error": str(e)}

def run_tests():
    print("=================================================================")
    print("RUNNING END-TO-END VERIFICATION ON MERGED FULL-STACK REPO")
    print("=================================================================\n")
    
    ts = int(time.time())
    teacher_email = f"prof.test.{ts}@university.edu"
    teacher_password = "Password123!"
    student1_reg = f"REG1_{ts}"
    student2_reg = f"REG2_{ts}"
    
    # ── 1. Teacher Signup & Login ──
    print("1. [AUTH] Registering Teacher:", teacher_email)
    res = request("POST", "/api/v1/auth/signup", {
        "firstName": "Professor",
        "lastName": "Turing",
        "email": teacher_email,
        "password": teacher_password,
        "role": "TEACHER",
        "college": "MIT",
        "department": "CS",
        "registrationNo": f"T-{ts}",
        "phone": "9876543210"
    })
    assert res["status"] in (200, 201), f"Teacher signup failed: {res}"
    verify_email_in_db(teacher_email)
    print("   [AUTH] Verified teacher email in DB.")
    
    print("   [AUTH] Logging in Teacher...")
    res = request("POST", "/api/v1/auth/login", {
        "email": teacher_email,
        "password": teacher_password
    })
    assert res["status"] == 200, f"Teacher login failed: {res}"
    teacher_token = res["data"]["token"]
    print("   [OK] Teacher JWT Token received.")

    # ── 2. Teacher Creates Quiz with Whitelist ──
    print(f"\n2. [TEACHER] Creating Quiz with Whitelist [{student1_reg}, {student2_reg}]...")
    now_str = time.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() + 3600))
    create_quiz_payload = {
        "title": f"Algorithm Analysis & AI Proctoring Test {ts}",
        "description": "Comprehensive integration test for proctoring and whitelist.",
        "instructions": "Answer all questions. Strict AI monitoring enabled.",
        "subject": "Data Structures",
        "subjectCode": "CS-301",
        "totalStudents": 2,
        "overallTimerSeconds": 1800,
        "negativeMarking": True,
        "negativeMarks": 0.25,
        "timeBonusEnabled": False,
        "randomQuestionOrder": True,
        "randomOptionOrder": True,
        "allowReview": True,
        "allowResume": True,
        "autoSubmit": True,
        "startTime": now_str,
        "endTime": end_str,
        "resultVisibility": "BOTH",
        "acceptedEmailDomain": None,
        "allowedRegistrationNumbers": [student1_reg, student2_reg],
        "questions": [
            {
                "questionText": "What is the time complexity of quickselect on average?",
                "imageUrl": "",
                "explanation": "Quickselect achieves O(n) average time complexity.",
                "questionType": "MCQ",
                "marks": 4,
                "negativeMarks": 1,
                "questionTimerSeconds": 60,
                "difficulty": "MEDIUM",
                "displayOrder": 1,
                "options": [
                    {"optionText": "O(n)", "optionImage": "", "optionOrder": 1, "isCorrect": True},
                    {"optionText": "O(n log n)", "optionImage": "", "optionOrder": 2, "isCorrect": False},
                    {"optionText": "O(n^2)", "optionImage": "", "optionOrder": 3, "isCorrect": False},
                    {"optionText": "O(log n)", "optionImage": "", "optionOrder": 4, "isCorrect": False}
                ]
            },
            {
                "questionText": "Which data structure is typically used for Dijkstra's shortest path algorithm?",
                "imageUrl": "",
                "explanation": "A Min-Priority Queue is used.",
                "questionType": "MCQ",
                "marks": 4,
                "negativeMarks": 1,
                "questionTimerSeconds": 60,
                "difficulty": "EASY",
                "displayOrder": 2,
                "options": [
                    {"optionText": "Min-Priority Queue / Min-Heap", "optionImage": "", "optionOrder": 1, "isCorrect": True},
                    {"optionText": "Stack", "optionImage": "", "optionOrder": 2, "isCorrect": False},
                    {"optionText": "Deque", "optionImage": "", "optionOrder": 3, "isCorrect": False},
                    {"optionText": "Circular Buffer", "optionImage": "", "optionOrder": 4, "isCorrect": False}
                ]
            }
        ]
    }
    res = request("POST", "/api/v1/teacher/quizzes", create_quiz_payload, teacher_token)
    assert res["status"] in (200, 201), f"Create quiz failed: {res}"
    quiz_data = res["data"]
    quiz_id = quiz_data["quizId"]
    quiz_code = quiz_data["quizCode"]
    print(f"   [OK] Quiz Created: ID = {quiz_id}, Code = {quiz_code}")
    print(f"   [OK] Whitelisted Registration Numbers: {quiz_data.get('allowedRegistrationNumbers', [])}")

    # ── 3. Teacher Publishes Quiz ──
    print(f"\n3. [TEACHER] Publishing Quiz {quiz_id}...")
    res = request("PUT", f"/api/v1/teacher/quizzes/{quiz_id}/publish", None, teacher_token)
    assert res["status"] in (200, 204), f"Publish quiz failed: {res}"
    print("   [OK] Quiz successfully published & active!")

    # ── 4. Student Availability Check ──
    print(f"\n4. [STUDENT] Checking availability for Code {quiz_code}...")
    # Register student 1 (whitelisted)
    student1_email = f"student.whitelisted.{ts}@university.edu"
    res = request("POST", "/api/v1/auth/signup", {
        "firstName": "Tanuj",
        "lastName": "Whitelisted",
        "email": student1_email,
        "password": "Password123!",
        "role": "STUDENT",
        "college": "VIT",
        "department": "CSE",
        "registrationNo": student1_reg,
        "phone": "9123456780"
    })
    assert res["status"] in (200, 201), f"Student 1 signup failed: {res}"
    verify_email_in_db(student1_email)
    
    res = request("POST", "/api/v1/auth/login", {
        "email": student1_email,
        "password": "Password123!"
    })
    assert res["status"] == 200, f"Student 1 login failed: {res}"
    student1_token = res["data"]["token"]
    
    res = request("GET", f"/api/v1/student/quizzes/{quiz_code}/availability", None, student1_token)
    assert res["status"] == 200 and res["data"]["available"] == True, f"Availability check failed: {res}"
    print(f"   [OK] Availability Status: {res['data']['status']} (available: {res['data']['available']})")

    # ── 5. Student 1 Starts Attempt (Whitelisted: 23BCE8830) ──
    print(f"\n5. [STUDENT] Attempting Start for Whitelisted Student ({student1_reg})...")
    res = request("POST", f"/api/v1/student/quizzes/{quiz_code}/attempts", {"registrationNo": student1_reg}, student1_token)
    assert res["status"] == 200, f"Start attempt failed for whitelisted student: {res}"
    attempt_id = res["data"]["attemptId"]
    print(f"   [OK] Attempt Started Successfully! Attempt ID = {attempt_id}")
    print(f"   [OK] Authoritative Effective Deadline: {res['data'].get('effectiveDeadline')}")

    # ── 6. Student Downloads Exam Package ──
    print(f"\n6. [STUDENT] Downloading Exam Package for Code {quiz_code}...")
    res = request("GET", f"/api/v1/student/quizzes/code/{quiz_code}/package", None, student1_token)
    assert res["status"] == 200, f"Package download failed: {res}"
    questions = res["data"]["questions"]
    print(f"   [OK] Received {len(questions)} Questions successfully.")

    # ── 7. AI Proctoring Telemetry ──
    print(f"\n7. [AI PROCTORING] Registering Device & Logging Malpractice Telemetry for Attempt {attempt_id}...")
    res = request("POST", f"/api/v1/attempts/{attempt_id}/device", {
        "browserName": "Chrome",
        "browserVersion": "130.0",
        "operatingSystem": "Windows",
        "deviceType": "LAPTOP",
        "screenWidth": 1920,
        "screenHeight": 1080,
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }, student1_token)
    assert res["status"] in (200, 201), f"Device footprint registration failed: {res}"
    print("   [OK] Device footprint registered.")

    # Log Tab Switch
    res = request("POST", f"/api/v1/attempts/{attempt_id}/activities", {
        "activityType": "TAB_SWITCH",
        "details": "Candidate switched away to another browser tab",
        "activityTime": time.strftime("%Y-%m-%dT%H:%M:%S")
    }, student1_token)
    assert res["status"] in (200, 201), f"Activity log failed: {res}"
    warnings_count = res["data"].get("currentWarningsCount", 1)
    print(f"   [OK] Tab Switch Recorded: Warnings = {warnings_count}/3")

    # Log Gaze Looking Away
    res = request("POST", f"/api/v1/attempts/{attempt_id}/activities", {
        "activityType": "LOOKING_AWAY",
        "details": "Edge-AI gaze tracking detected face turned away from screen",
        "activityTime": time.strftime("%Y-%m-%dT%H:%M:%S")
    }, student1_token)
    assert res["status"] in (200, 201), f"Gaze log failed: {res}"
    warnings_count = res["data"].get("currentWarningsCount", 2)
    print(f"   [OK] Looking Away Recorded: Warnings = {warnings_count}/3")

    # ── 8. Student Submits Assessment ──
    print(f"\n8. [STUDENT] Submitting Assessment Attempt {attempt_id}...")
    q1_id = questions[0]["questionId"]
    q1_opt_id = questions[0]["options"][0]["optionId"]
    q2_id = questions[1]["questionId"]
    q2_opt_id = questions[1]["options"][0]["optionId"]
    
    submit_payload = {
        "answers": [
            {"questionId": q1_id, "selectedOptionIds": [q1_opt_id], "responseTimeSeconds": 15},
            {"questionId": q2_id, "selectedOptionIds": [q2_opt_id], "responseTimeSeconds": 20}
        ]
    }
    res = request("POST", f"/api/v1/student/attempts/{attempt_id}/submit", submit_payload, student1_token)
    assert res["status"] == 200, f"Submit attempt failed: {res}"
    print(f"   [OK] Assessment Submitted Successfully! Final Score = {res['data'].get('finalScore')} / {res['data'].get('totalMarks')}")

    # ── 9. Non-Whitelisted Student Rejection Verification ──
    print("\n9. [SECURITY] Testing Non-Whitelisted Student Rejection...")
    rejected_email = f"student.rejected.{ts}@university.edu"
    rejected_reg = f"REJ_{ts}"
    res = request("POST", "/api/v1/auth/signup", {
        "firstName": "Intruder",
        "lastName": "User",
        "email": rejected_email,
        "password": "Password123!",
        "role": "STUDENT",
        "college": "Unknown",
        "department": "Other",
        "registrationNo": rejected_reg,
        "phone": "9999999999"
    })
    assert res["status"] in (200, 201), f"Rejected student signup failed: {res}"
    verify_email_in_db(rejected_email)
    res = request("POST", "/api/v1/auth/login", {"email": rejected_email, "password": "Password123!"})
    assert res["status"] == 200, f"Rejected student login failed: {res}"
    rejected_token = res["data"]["token"]
    
    res = request("POST", f"/api/v1/student/quizzes/{quiz_code}/attempts", {"registrationNo": rejected_reg}, rejected_token)
    assert res["status"] in (400, 403) and res["data"].get("code") == "STUDENT_REGISTRATION_NOT_ALLOWED", f"Expected rejection for non-whitelisted student, got: {res}"
    print(f"   [OK] Non-whitelisted student properly REJECTED with code {res['data'].get('code')}: {res['data'].get('message')}")

    # ── 10. Teacher Live & Governance Endpoints ──
    print("\n10. [TEACHER] Verifying Teacher Live Monitor & Assessment Roster...")
    res = request("GET", f"/api/v1/teacher/quizzes/{quiz_id}/leaderboard", None, teacher_token)
    assert res["status"] == 200, f"Teacher leaderboard failed: {res}"
    print(f"   [OK] Teacher Leaderboard synchronized ({len(res['data'])} submissions).")
    
    res = request("GET", f"/api/v1/teacher/quizzes/{quiz_id}/proctoring-overview", None, teacher_token)
    assert res["status"] == 200, f"Teacher proctoring overview failed: {res}"
    print(f"   [OK] Teacher Proctoring Overview synchronized (Violations logged: {res['data'].get('totalViolations', 0)}).")

    print("\n=================================================================")
    print("[SUCCESS] ALL 10 END-TO-END TESTS PASSED WITH ZERO ERRORS!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
