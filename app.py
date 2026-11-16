from flask import Flask, jsonify, render_template, request
from pathlib import Path
import sqlite3
import json
from datetime import datetime, timezone

app = Flask(__name__)
DB = Path("data/miniboard.db")

def connect():
    DB.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            choices TEXT NOT NULL,
            answer_index INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )""")

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/quizzes")
def get_quizzes():
    with connect() as con:
        rows = con.execute("SELECT * FROM quizzes ORDER BY id ASC").fetchall()
    result = []
    for r in rows:
        item = dict(r)
        item["choices"] = json.loads(item["choices"])
        result.append(item)
    return jsonify(result)

@app.post("/api/quizzes")
def create_quiz():
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()[:300]
    choices_raw = data.get("choices")
    answer_index = data.get("answer_index")

    if not question:
        return jsonify({"error": "question is required"}), 400
    if not isinstance(choices_raw, list) or len(choices_raw) < 2:
        return jsonify({"error": "at least 2 choices are required"}), 400

    choices = [str(c).strip()[:100] for c in choices_raw]
    if any(not c for c in choices):
        return jsonify({"error": "choices must not contain empty strings"}), 400

    if isinstance(answer_index, bool) or not isinstance(answer_index, int) or not (0 <= answer_index < len(choices)):
        return jsonify({"error": "invalid answer_index"}), 400

    created_at = datetime.now(timezone.utc).isoformat()
    choices_json = json.dumps(choices, ensure_ascii=False)

    with connect() as con:
        cur = con.execute(
            "INSERT INTO quizzes(question, choices, answer_index, created_at) VALUES(?, ?, ?, ?)",
            (question, choices_json, answer_index, created_at)
        )
        row = con.execute("SELECT * FROM quizzes WHERE id=?", (cur.lastrowid,)).fetchone()

    item = dict(row)
    item["choices"] = json.loads(item["choices"])
    return jsonify(item), 201

@app.delete("/api/quizzes/<int:quiz_id>")
def delete_quiz(quiz_id):
    with connect() as con:
        cur = con.execute("DELETE FROM quizzes WHERE id=?", (quiz_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
    return "", 204

@app.get("/api/scores")
def get_scores():
    with connect() as con:
        rows = con.execute("SELECT * FROM scores ORDER BY score DESC, id ASC").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/scores")
def create_score():
    data = request.get_json(silent=True) or {}
    player_name = str(data.get("player_name", "")).strip()[:30]
    score = data.get("score")
    total = data.get("total")

    if (
        isinstance(score, bool) or not isinstance(score, int) or
        isinstance(total, bool) or not isinstance(total, int) or
        total <= 0 or not (0 <= score <= total)
    ):
        return jsonify({"error": "invalid score or total"}), 400

    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        if not player_name:
            cur = con.execute(
                "INSERT INTO scores(player_name, score, total, created_at) VALUES(?, ?, ?, ?)",
                ("", score, total, created_at)
            )
            score_id = cur.lastrowid
            player_name = f"名無し #{score_id}"
            con.execute("UPDATE scores SET player_name=? WHERE id=?", (player_name, score_id))
        else:
            cur = con.execute(
                "INSERT INTO scores(player_name, score, total, created_at) VALUES(?, ?, ?, ?)",
                (player_name, score, total, created_at)
            )
            score_id = cur.lastrowid

        row = con.execute("SELECT * FROM scores WHERE id=?", (score_id,)).fetchone()
    return jsonify(dict(row)), 201


# @app.get("/api/messages")
# def get_messages():
#     with connect() as con:
#         rows = con.execute("SELECT * FROM messages ORDER BY id DESC").fetchall()
#     return jsonify([dict(r) for r in rows])

# @app.post("/api/messages")
# def create_message():
#     data = request.get_json(silent=True) or {}
#     name = str(data.get("name", "")).strip()[:30]
#     message = str(data.get("message", "")).strip()[:300]
#     if not name or not message:
#         return jsonify({"error": "name and message are required"}), 400
#     created_at = datetime.now(timezone.utc).isoformat()
#     with connect() as con:
#         cur = con.execute("INSERT INTO messages(name,message,created_at) VALUES(?,?,?)", (name,message,created_at))
#         row = con.execute("SELECT * FROM messages WHERE id=?", (cur.lastrowid,)).fetchone()
#     return jsonify(dict(row)), 201

# @app.put("/api/messages/<int:message_id>")
# def update_message(message_id):
#     data = request.get_json(silent=True) or {}
#     message = str(data.get("message", "")).strip()[:300]
#     if not message:
#         return jsonify({"error": "message is required"}), 400
#     with connect() as con:
#         cur = con.execute("UPDATE messages SET message=? WHERE id=?", (message,message_id))
#         if cur.rowcount == 0:
#             return jsonify({"error": "not found"}), 404
#     return jsonify({"ok": True})

# @app.delete("/api/messages/<int:message_id>")
# def delete_message(message_id):
#     with connect() as con:
#         cur = con.execute("DELETE FROM messages WHERE id=?", (message_id,))
#         if cur.rowcount == 0:
#             return jsonify({"error": "not found"}), 404
#     return "", 204

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)
