import importlib
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


class PhotoQuestionFlowTests(unittest.TestCase):
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

    def tearDown(self):
        self.tmp.cleanup()

    def _client(self):
        return TestClient(self.api.app)

    def _image_file(self, content_type: str = "image/png"):
        return {"image": ("photo.png", b"fake image bytes", content_type)}

    def test_photo_ask_rejects_invalid_image_type(self):
        with self._client() as client:
            response = client.post(
                "/api/ask/photo",
                data={"question": "What does this alarm mean?"},
                files={"image": ("note.txt", b"not an image", "text/plain")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("unsupported image type", response.json()["detail"])

    def test_photo_ask_rejects_oversized_image(self):
        with (
            patch.object(self.api, "PHOTO_MAX_BYTES", 4),
            patch.object(
                self.api.llm_client,
                "describe_image",
                side_effect=AssertionError("image analysis was called"),
            ),
            self._client() as client,
        ):
            response = client.post(
                "/api/ask/photo",
                data={"question": "What does this alarm mean?"},
                files=self._image_file(),
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("image too large", response.json()["detail"])

    def test_photo_ask_text_safety_returns_before_image_analysis(self):
        with (
            patch.object(
                self.api.llm_client,
                "describe_image",
                side_effect=AssertionError("image analysis was called"),
            ),
            patch.object(
                self.api.rag,
                "answer_photo_question",
                side_effect=AssertionError("RAG was called"),
            ),
            self._client() as client,
        ):
            response = client.post(
                "/api/ask/photo",
                data={"question": "Someone reaching inside the machine."},
                files=self._image_file(),
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("Safety Alert", body["answer"])
        self.assertEqual(body["sources"], [])
        self.assertTrue(body["is_safety_critical"])

    def test_photo_ask_image_observation_safety_routes_before_retrieval(self):
        with (
            patch.object(
                self.api.llm_client,
                "describe_image",
                return_value="The photo shows smoke and sparks from an electrical panel.",
            ),
            patch.object(
                self.api.rag.db,
                "search_by_keywords",
                side_effect=AssertionError("retrieval was called"),
            ),
            patch.object(
                self.api.rag.llm_client,
                "chat",
                side_effect=AssertionError("LLM answer was called"),
            ),
            self._client() as client,
        ):
            response = client.post(
                "/api/ask/photo",
                data={"question": "What should I check?"},
                files=self._image_file(),
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("Image observation:", body["answer"])
        self.assertIn("Safety Alert", body["answer"])
        self.assertEqual(body["sources"], [])
        self.assertTrue(body["is_safety_critical"])

    def test_photo_ask_normal_path_uses_image_observation_and_rag(self):
        rag_response = {
            "answer": (
                "Image observation:\nAlarm screen shows low vacuum alarm.\n\n"
                "_This image observation is AI-generated from the uploaded photo and is not a confirmed diagnosis._\n\n"
                "Check the vacuum cups. [#1]"
            ),
            "sources": [
                {
                    "index": 1,
                    "id": 1,
                    "kind": "manual_chunk",
                    "metadata": {"manual_title": "Machine 3 Manual"},
                    "preview": "Low vacuum alarm",
                }
            ],
            "conversation_id": 123,
            "image_observation": "Alarm screen shows low vacuum alarm.",
        }

        with (
            patch.object(
                self.api.llm_client,
                "describe_image",
                return_value="Alarm screen shows low vacuum alarm.",
            ),
            patch.object(
                self.api.rag,
                "answer_photo_question",
                return_value=rag_response,
            ) as rag,
            self._client() as client,
        ):
            response = client.post(
                "/api/ask/photo",
                data={"question": "What should I check?"},
                files=self._image_file(),
            )

        self.assertEqual(response.status_code, 200)
        rag.assert_called_once_with(
            "What should I check?",
            "Alarm screen shows low vacuum alarm.",
            step_by_step=False,
        )
        body = response.json()
        self.assertIn("Image observation:", body["answer"])
        self.assertEqual(body["sources"][0]["kind"], "manual_chunk")


if __name__ == "__main__":
    unittest.main()
