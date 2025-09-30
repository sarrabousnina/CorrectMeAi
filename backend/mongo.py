# mongo.py
from pymongo import MongoClient, DESCENDING
import config  # <— new

client = MongoClient(config.MONGO_URI)
db = client["exam_system"]

# Collections
exams_collection        = db["exams"]
submissions_collection  = db["submissions"]
users_collection        = db["users"] 

# Helpful indexes (safe if already exist)
users_collection.create_index("email", unique=True)
submissions_collection.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
exams_collection.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
