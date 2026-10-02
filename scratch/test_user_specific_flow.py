import time
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8080"

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

def run():
    print("=================================================================")
    print("USER SPECIFIC VERIFICATION: 23BCE8830 & 23BCE8878 WHITELIST TEST")
    print("=================================================================\n")

    # 1. Teacher Login
    print("1. [TEACHER] Logging in teacher@dynoquizz.edu...")
    res = request("POST", "/api/v1/auth/login", {
        "email": "teacher@dynoquizz.edu",
        "password": "Password123!"
    })
    assert res["status"] == 200, f"Teacher login failed: {res}"
    teacher_token = res["data"]["token"]
    print("   [OK] Teacher Authenticated successfully.")

    # 2. Teacher Creates Quiz for 23BCE8830 and 23BCE8878
    ts = int(time.time())
    now_str = time.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() + 7200))
    
    quiz_payload = {
        "title": f"Mid-Term Exam - Data Structures {ts}",
        "description": "Exclusive exam for registered candidates.",
        "instructions": "Answer all questions. Strict AI proctoring enabled.",
        "subject": "Computer Science",
        "subjectCode": "CSE-201",
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
                "questionText": "What is the worst-case time complexity of binary search on a sorted array?",
                "imageUrl": "",
                "explanation": "Binary search divides the search space in half each step, leading to O(log n).",
                "questionType": "MCQ",
                "marks": 5,
                "negativeMarks": 1,
                "questionTimerSeconds": 120,
                "difficulty": "EASY",
                "displayOrder": 1,
                "options": [
                    {"optionText": "O(log n)", "optionImage": "", "optionOrder": 1, "isCorrect": True},
                    {"optionText": "O(n)", "optionImage": "", "optionOrder": 2, "isCorrect": False},
                    {"optionText": "O(n log n)", "optionImage": "", "optionOrder": 3, "isCorrect": False},
                    {"optionText": "O(1)", "optionImage": "", "optionOrder": 4, "isCorrect": False}
                ]
            }
        ]
    }
    
    print("\n2. [TEACHER] Creating Quiz with whitelisted candidates [23BCE8830, 23BCE8878]...")
    res = request("POST", "/api/v1/teacher/quizzes", quiz_payload, teacher_token)
    assert res["status"] in (200, 201), f"Create quiz failed: {res}"
    quiz_id = res["data"]["quizId"]
    quiz_code = res["data"]["quizCode"]
    print(f"   [OK] Quiz Created! ID = {quiz_id}, Quiz Code = {quiz_code}")
    print(f"   [OK] Whitelist registered: {res['data'].get('allowedRegistrationNumbers')}")

    # 3. Publish Quiz
    print(f"\n3. [TEACHER] Publishing Quiz Code {quiz_code}...")
    res = request("PUT", f"/api/v1/teacher/quizzes/{quiz_id}/publish", None, teacher_token)
    assert res["status"] in (200, 204), f"Publish failed: {res}"
    print("   [OK] Quiz is now LIVE and accessible.")

    # 4. Student 1 (23BCE8830) Login & Take Exam
    print(f"\n4. [STUDENT 1] Logging in student_reg8830@dynoquizz.edu (Roll: 23BCE8830)...")
    res = request("POST", "/api/v1/auth/login", {
        "email": "student_reg8830@dynoquizz.edu",
        "password": "Password123!"
    })
    assert res["status"] == 200, f"Student 1 login failed: {res}"
    student1_token = res["data"]["token"]
    print("   [OK] Student 1 Authenticated.")

    print(f"   [STUDENT 1] Starting attempt for Quiz Code {quiz_code}...")
    res = request("POST", f"/api/v1/student/quizzes/{quiz_code}/attempts", {"registrationNo": "23BCE8830"}, student1_token)
    assert res["status"] == 200, f"Student 1 start attempt failed: {res}"
    attempt1_id = res["data"]["attemptId"]
    print(f"   [OK] Attempt Started! Attempt ID = {attempt1_id}")

    # Package download & submit
    res = request("GET", f"/api/v1/student/quizzes/code/{quiz_code}/package", None, student1_token)
    assert res["status"] == 200, f"Package download failed: {res}"
    questions = res["data"]["questions"]
    q1 = questions[0]
    opt_selected = q1["options"][0]["optionId"]

    res = request("POST", f"/api/v1/student/attempts/{attempt1_id}/submit", {
        "answers": [{"questionId": q1["questionId"], "selectedOptionIds": [opt_selected], "responseTimeSeconds": 25}]
    }, student1_token)
    assert res["status"] == 200, f"Submit attempt failed: {res}"
    print(f"   [OK] Student 1 Submitted Exam! Final Score: {res['data'].get('finalScore')} / {res['data'].get('totalMarks')}")

    # 5. Student 2 (23BCE8878) Login & Take Exam
    print(f"\n5. [STUDENT 2] Logging in student_tester@dynoquizz.edu (Roll: 23BCE8878)...")
    res = request("POST", "/api/v1/auth/login", {
        "email": "student_tester@dynoquizz.edu",
        "password": "Password123!"
    })
    assert res["status"] == 200, f"Student 2 login failed: {res}"
    student2_token = res["data"]["token"]
    print("   [OK] Student 2 Authenticated.")

    print(f"   [STUDENT 2] Starting attempt for Quiz Code {quiz_code}...")
    res = request("POST", f"/api/v1/student/quizzes/{quiz_code}/attempts", {"registrationNo": "23BCE8878"}, student2_token)
    assert res["status"] == 200, f"Student 2 start attempt failed: {res}"
    attempt2_id = res["data"]["attemptId"]
    print(f"   [OK] Attempt Started! Attempt ID = {attempt2_id}")

    # 6. Verify Teacher View & Allowed Registration Numbers
    print(f"\n6. [TEACHER] Verifying Teacher Assessment Details & Whitelist...")
    res = request("GET", f"/api/v1/teacher/quizzes/{quiz_id}", None, teacher_token)
    assert res["status"] == 200, f"Get quiz failed: {res}"
    allowed_list = res["data"].get("allowedRegistrationNumbers", [])
    print(f"   [OK] Teacher Assessment Detail confirms Whitelist: {allowed_list}")
    assert "23BCE8830" in allowed_list and "23BCE8878" in allowed_list, "Whitelist missing roll numbers"

    print("\n=================================================================")
    print("[SUCCESS] VERIFICATION COMPLETE: Quiz Code " + str(quiz_code) + " is LIVE and verified for 23BCE8830 & 23BCE8878!")
    print("=================================================================")

if __name__ == "__main__":
    run()
