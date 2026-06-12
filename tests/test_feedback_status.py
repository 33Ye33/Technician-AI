import importlib
import os
import sqlite3
import tempfile
import unittest


class FeedbackStatusTests(unittest.TestCase):
    def test_status_is_written_to_conversations_table(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "tech.db")
            os.environ["TECHNICIAN_AI_DB"] = db_path

            import technician_ai.database as database

            database = importlib.reload(database)
            database.init_db()

            conversation_id = database.insert_conversation(
                "How do I turn it off?",
                "Turn it off safely.",
                [],
            )
            database.update_conversation_status(conversation_id, "worked")

            with sqlite3.connect(db_path) as conn:
                row = conn.execute(
                    "SELECT status FROM conversations WHERE id = ?",
                    (conversation_id,),
                ).fetchone()

            self.assertEqual(row[0], "worked")


if __name__ == "__main__":
    unittest.main()
