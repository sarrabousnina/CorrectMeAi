# mongo.py

from pymongo import MongoClient

# Connection string to your MongoDB Atlas cluster
CONNECTION_STRING = (
    "mongodb+srv://admin:admin@examcluster.dpdod2i.mongodb.net/"
    "?retryWrites=true&w=majority&appName=ExamCluster"
)

# Create the client and select the database
client = MongoClient(CONNECTION_STRING)
db = client["exam_system"]  # Database name

# Define the collections you’ll use
exams_collection = db["exams"]
submissions_collection = db["submissions"]
