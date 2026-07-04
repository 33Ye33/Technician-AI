import importlib
import os
import tempfile
import unittest
from unittest.mock import patch


class SafetyGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TECHNICIAN_AI_DB"] = os.path.join(self.tmp.name, "tech.db")

        import technician_ai.database as database
        import technician_ai.retrieval as retrieval

        self.database = importlib.reload(database)
        self.retrieval = importlib.reload(retrieval)
        self.retrieval.EMBEDDINGS_ENABLED = False
        self.database.init_db()

    def tearDown(self):
        self.tmp.cleanup()

    def _assert_no_retrieval_or_llm(self):
        return (
            patch.object(
                self.retrieval.db,
                "search_by_keywords",
                side_effect=AssertionError("retrieval was called"),
            ),
            patch.object(
                self.retrieval.db,
                "search_similar",
                side_effect=AssertionError("retrieval was called"),
            ),
            patch.object(
                self.retrieval.llm_client,
                "chat",
                side_effect=AssertionError("LLM was called"),
            ),
        )

    def test_ask_safety_input_returns_alert_before_retrieval_or_llm(self):
        retrieval_patch, vector_patch, llm_patch = self._assert_no_retrieval_or_llm()
        with retrieval_patch, vector_patch, llm_patch:
            result = self.retrieval.answer_question(
                "Someone is reaching inside the machine and the arm moved suddenly."
            )

        self.assertIn("Safety Alert", result["answer"])
        self.assertEqual(result["sources"], [])
        self.assertNotIn("[#1]", result["answer"])
        self.assertTrue(result["is_safety_critical"])

    def test_ask_chinese_safety_input_returns_alert_before_retrieval_or_llm(self):
        retrieval_patch, vector_patch, llm_patch = self._assert_no_retrieval_or_llm()
        with retrieval_patch, vector_patch, llm_patch:
            result = self.retrieval.answer_question(
                "机器突然移动，有人在机器里面。"
            )

        self.assertIn("Safety Alert", result["answer"])
        self.assertEqual(result["sources"], [])
        self.assertTrue(result["is_safety_critical"])

    def test_ask_non_safety_input_uses_normal_answer_path(self):
        self.database.insert_document(
            kind="manual_chunk",
            text="Machine 3 low vacuum alarm: inspect vacuum cups and hoses.",
            embedding=None,
            metadata={"manual_title": "Machine 3 Manual"},
        )

        with patch.object(
            self.retrieval.llm_client,
            "chat",
            return_value="Check the vacuum cups and hoses. [#1]",
        ) as chat:
            result = self.retrieval.answer_question(
                "Machine 3 has a low vacuum alarm."
            )

        chat.assert_called_once()
        self.assertNotIn("Safety Alert", result["answer"])
        self.assertGreater(len(result["sources"]), 0)
        self.assertEqual(result["sources"][0]["kind"], "manual_chunk")

    def test_diagnosis_first_turn_safety_still_returns_alert(self):
        question = (
            "A sheet of glass broke inside the running machine near the robot arm."
        )
        session = self.retrieval.diagnosis_fsm.new_session(
            question, is_safety_critical=False
        )

        retrieval_patch, vector_patch, llm_patch = self._assert_no_retrieval_or_llm()
        with retrieval_patch, vector_patch, llm_patch:
            result = self.retrieval.diagnose_step(
                question,
                history=[],
                session=session,
            )

        self.assertIn("Safety Alert", result["message"])
        self.assertEqual(result["sources"], [])
        self.assertTrue(result["is_safety_critical"])
        self.assertEqual(result["hazard_type"], "broken_glass")

    def test_diagnosis_mid_session_new_hazard_enters_safety_hold(self):
        question = "Machine 3 has an intermittent low vacuum alarm."
        session = self.retrieval.diagnosis_fsm.new_session(
            question, is_safety_critical=False
        )
        history = [
            {"role": "assistant", "content": "What do you see at the pickup head?"},
            {
                "role": "user",
                "content": "Someone is reaching inside and the machine moved unexpectedly.",
            },
        ]

        retrieval_patch, vector_patch, llm_patch = self._assert_no_retrieval_or_llm()
        with retrieval_patch, vector_patch, llm_patch:
            result = self.retrieval.diagnose_step(
                question,
                history=history,
                session=session,
                machine="Machine 3",
            )

        self.assertIn("Safety Alert", result["message"])
        self.assertEqual(result["sources"], [])
        self.assertTrue(result["is_safety_critical"])
        self.assertEqual(result["phase"], "safety_hold")
        self.assertEqual(session["state"], self.retrieval.diagnosis_fsm.STATE_SAFETY_CHECK)
        self.assertTrue(session["is_safety_critical"])
        self.assertEqual(session["hazard_type"], result["hazard_type"])


if __name__ == "__main__":
    unittest.main()
