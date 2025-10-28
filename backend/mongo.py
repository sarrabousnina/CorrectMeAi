from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
import os

# Load environment variables (safe to call multiple times)
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = MongoClient(MONGO_URI)
db = client["exam_system"]

# Collections
exams_collection = db["exams"]
submissions_collection = db["submissions"]
users_collection = db["users"]
course_materials_collection = db["course_materials"]


# Ensure essential indexes
users_collection.create_index("email", unique=True)
submissions_collection.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
exams_collection.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
course_materials_collection.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])