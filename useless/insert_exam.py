# insert_exam.py
from mongo import exams_collection

# Define a sample exam
exam = {
    "title": "Math Midterm 2025",
    "created_by": "prof123",
    "answer_key": [
        {"question_id": "q1", "expected_answer": "5"},
        {"question_id": "q2", "expected_answer": "Paris"}
    ]
}

# Insert into MongoDB
result = exams_collection.insert_one(exam)
print(f"✅ Exam inserted with ID: {result.inserted_id}")
