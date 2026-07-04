import importlib
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


class StepInstructionModeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TECHNICIAN_AI_DB"] = os.path.join(self.tmp.name, "tech.db")

        import technician_ai.database as database
        import technician_ai.retrieval as retrieval
        import technician_ai.api as api

        self.database = importlib.reload(database)
        self.retrieval = importlib.reload(retrieval)
        self.api = importlib.reload(api)
        self.retrieval.EMBEDDINGS_ENABLED = False
        self.api.rag.EMBEDDINGS_ENABLED = False
        self.database.init_db()

    def tearDown(self):
        self.tmp.cleanup()

    def _insert_low_vacuum_doc(self):
        return self.database.insert_document(
            kind="manual_chunk",
            text=(
                "Machine 3 low vacuum alarm: inspect vacuum cups, vacuum hoses, "
                "and the filter bowl before replacing parts."
            ),
            embedding=None,
            metadata={"manual_title": "Machine 3 Manual"},
        )

    def _procedure_json(self):
        return json.dumps(
            {
                "safety_first": ["Stop the machine before touching the pickup head. [#1]"],
                "tools_needed": ["Flashlight", "Clean cloth"],
                "steps": [
                    {
                        "title": "Inspect vacuum cups",
                        "instruction": "Check each cup for cracks or debris. [#1]",
                        "expected_result": "Cups are clean and seated.",
                    }
                ],
                "expected_result": "The low vacuum alarm clears after the leak is corrected.",
                "stop_and_ask_supervisor": [
                    "Stop if a repair is not covered by the retrieved procedure."
                ],
            }
        )

    def test_normal_ask_step_by_step_false_still_uses_normal_path(self):
        self._insert_low_vacuum_doc()
        with patch.object(
            self.retrieval.llm_client,
            "chat",
            return_value="Check the vacuum cups and hoses. [#1]",
        ) as chat:
            result = self.retrieval.answer_question(
                "Machine 3 has a low vacuum alarm.",
                step_by_step=False,
            )

        chat.assert_called_once()
        self.assertIsNone(chat.call_args.kwargs.get("json_schema"))
        self.assertNotIn("procedure", result)
        self.assertNotEqual(result.get("mode"), "step_by_step")
        self.assertEqual(result["sources"][0]["kind"], "manual_chunk")

    def test_step_mode_safety_input_returns_alert_without_procedure(self):
        with (
            patch.object(
                self.retrieval.db,
                "search_by_keywords",
                side_effect=AssertionError("retrieval was called"),
            ),
            patch.object(
                self.retrieval.llm_client,
                "chat",
                side_effect=AssertionError("LLM was called"),
            ),
        ):
            result = self.retrieval.answer_question(
                "Someone is reaching inside the machine and the arm moved suddenly.",
                step_by_step=True,
            )

        self.assertIn("Safety Alert", result["answer"])
        self.assertEqual(result["sources"], [])
        self.assertNotIn("procedure", result)
        self.assertTrue(result["is_safety_critical"])

    def test_step_mode_normal_input_returns_procedure(self):
        self._insert_low_vacuum_doc()
        with patch.object(
            self.retrieval.llm_client,
            "chat",
            return_value=self._procedure_json(),
        ) as chat:
            result = self.retrieval.answer_question(
                "Machine 3 has a low vacuum alarm.",
                step_by_step=True,
            )

        chat.assert_called_once()
        self.assertIsNotNone(chat.call_args.kwargs.get("json_schema"))
        self.assertEqual(result["mode"], "step_by_step")
        self.assertIn("procedure", result)
        self.assertEqual(result["procedure"]["steps"][0]["title"], "Inspect vacuum cups")
        self.assertIn("## Safety first", result["answer"])
        self.assertEqual(result["sources"][0]["kind"], "manual_chunk")

    def test_step_mode_invalid_json_falls_back_to_markdown_answer(self):
        self._insert_low_vacuum_doc()
        with patch.object(
            self.retrieval.llm_client,
            "chat",
            side_effect=["not json", "Use the normal low vacuum checklist. [#1]"],
        ) as chat:
            result = self.retrieval.answer_question(
                "Machine 3 has a low vacuum alarm.",
                step_by_step=True,
            )

        self.assertEqual(chat.call_count, 2)
        self.assertNotIn("procedure", result)
        self.assertEqual(result["answer"], "Use the normal low vacuum checklist. [#1]")
        self.assertEqual(result["sources"][0]["kind"], "manual_chunk")

    def test_photo_ask_step_mode_includes_observation_and_procedure(self):
        self._insert_low_vacuum_doc()
        with (
            patch.object(
                self.api.llm_client,
                "describe_image",
                return_value="Alarm screen shows Machine 3 low vacuum alarm.",
            ),
            patch.object(
                self.api.rag.llm_client,
                "chat",
                return_value=self._procedure_json(),
            ) as chat,
            TestClient(self.api.app) as client,
        ):
            response = client.post(
                "/api/ask/photo",
                data={"question": "What should I check?", "step_by_step": "true"},
                files={"image": ("alarm.png", b"fake image bytes", "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["mode"], "step_by_step")
        self.assertIn("Image observation:", body["answer"])
        self.assertEqual(
            body["image_observation"],
            "Alarm screen shows Machine 3 low vacuum alarm.",
        )
        self.assertIn("procedure", body)
        self.assertIsNotNone(chat.call_args.kwargs.get("json_schema"))


if __name__ == "__main__":
    unittest.main()
