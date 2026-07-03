import importlib
import os
import sqlite3
import tempfile
import unittest


class FeedbackStatusTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TECHNICIAN_AI_DB"] = os.path.join(self.tmp.name, "tech.db")

        import technician_ai.database as database
        import technician_ai.retrieval as retrieval

        self.database = importlib.reload(database)
        self.retrieval = importlib.reload(retrieval)
        self.retrieval.EMBEDDINGS_ENABLED = False
        self.retrieval.tagger.tag_content = lambda *_, **__: {
            "topic_path": ["field_knowledge"],
            "entry_type": "troubleshooting",
            "title": "field knowledge",
        }
        self.database.init_db()

    def tearDown(self):
        self.tmp.cleanup()

    def test_status_is_written_to_conversations_table(self):
        conversation_id = self.database.insert_conversation(
            "How do I turn it off?",
            "Turn it off safely.",
            [],
        )
        self.database.update_conversation_status(conversation_id, "worked")

        with sqlite3.connect(os.environ["TECHNICIAN_AI_DB"]) as conn:
            row = conn.execute(
                "SELECT status, feedback_note FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()

        self.assertEqual(row[0], "worked")
        self.assertIsNone(row[1])

    def test_feedback_notes_are_persisted(self):
        conversation_id = self.database.insert_conversation(
            "Why did it stop?",
            "Check the conveyor.",
            [],
        )
        self.database.update_conversation_status(conversation_id, "failed")
        self.database.update_conversation_feedback_note(
            conversation_id,
            "The motor stalled at the end of shift.",
        )

        with sqlite3.connect(os.environ["TECHNICIAN_AI_DB"]) as conn:
            row = conn.execute(
                "SELECT status, feedback_note FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()

        self.assertEqual(row[0], "failed")
        self.assertEqual(row[1], "The motor stalled at the end of shift.")

    def test_diagnose_feedback_comment_can_be_saved_as_knowledge(self):
        self.database.upsert_diagnose_session(
            session_id="session-1",
            question="Glass loader is missing panels.",
            machine="Glass Loading Machine",
            history=[],
            retrieved_doc_ids=[],
            is_resolved=True,
            final_resolution="Vacuum cups were worn.",
            confidence="high",
        )

        updated = self.database.update_diagnose_feedback(
            "session-1",
            5,
            "Replacing the worn vacuum cups fixed pickup failures.",
        )
        session = self.database.get_diagnose_session("session-1")
        entry = self.retrieval.record_field_note(
            question=session["question"],
            answer=session["final_resolution"],
            comment=session["feedback_comment"],
            source_id=session["session_id"],
            source_type="diagnose_session",
            machine=session["machine"],
        )

        self.assertTrue(updated)
        self.assertEqual(session["rating"], 5)
        self.assertEqual(
            session["feedback_comment"],
            "Replacing the worn vacuum cups fixed pickup failures.",
        )
        self.assertGreater(entry["id"], 0)
        saved = self.database.list_knowledge_entries()
        self.assertEqual(saved[0]["metadata"]["source_type"], "diagnose_session")
        self.assertIn("vacuum cups", saved[0]["text"])

    def test_structured_field_knowledge_is_searchable(self):
        entry = self.retrieval.record_structured_field_knowledge(
            symptom="Glass loader drops panels during pickup.",
            machine="Glass Loading Machine",
            component="Vacuum cup",
            tried="Checked air pressure and cleaned the cup.",
            confirmed_fix="Replaced cracked vacuum cup.",
            confidence="Confirmed",
            technician_note="Failure returned when humidity was high.",
            source_conversation_id=42,
        )

        self.assertGreater(entry["id"], 0)
        self.assertEqual(entry["metadata"]["origin"], "structured_field_knowledge")
        self.assertEqual(entry["metadata"]["component"], "Vacuum cup")
        self.assertIn("Confirmed Fix: Replaced cracked vacuum cup.", entry["text"])

        results = self.database.search_by_keywords(
            "Glass Loading Machine vacuum cup cracked pickup",
            k=3,
        )
        self.assertEqual(results[0]["id"], entry["id"])
        self.assertEqual(results[0]["kind"], "knowledge_entry")

    def test_structured_field_knowledge_rejects_blank_symptom(self):
        with self.assertRaises(ValueError):
            self.retrieval.record_structured_field_knowledge(
                symptom="   ",
                confirmed_fix="Replaced cracked vacuum cup.",
            )

        self.assertEqual(self.database.list_knowledge_entries(), [])

    def test_structured_field_knowledge_rejects_blank_confirmed_fix(self):
        with self.assertRaises(ValueError):
            self.retrieval.record_structured_field_knowledge(
                symptom="Glass loader drops panels during pickup.",
                confirmed_fix="   ",
            )

        self.assertEqual(self.database.list_knowledge_entries(), [])


if __name__ == "__main__":
    unittest.main()
