from flask import Flask, jsonify
from flask_cors import CORS
from mongo import exams_collection

app = Flask(__name__)
CORS(app)

@app.get("/ListExams")
def list_exams():
    # Fetch only the fields we need
    docs = list(exams_collection.find({}, {"title": 1, "answer_key": 1, "pages": 1, "stats": 1}))
    out = []
    for d in docs:
        has_key = bool(d.get("answer_key")) and len(d["answer_key"]) > 0
        out.append({
            "_id": str(d["_id"]),                         # keep for links (don’t render in UI)
            "title": d.get("title") or "Untitled exam",
            "hasKey": has_key,                            # boolean for the UI
            "status": "published" if has_key else "draft",
            "pagesCount": len(d.get("pages") or []),
            "submissionsCount": (d.get("stats") or {}).get("submissions", 0),
        })
    return jsonify(out)

if __name__ == "__main__":
    app.run(port=5005, debug=True)
