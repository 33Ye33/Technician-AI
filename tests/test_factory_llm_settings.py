import importlib
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch


class FactoryLlmSettingsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TECHNICIAN_AI_DB"] = os.path.join(self.tmp.name, "tech.db")

        import technician_ai.database as database
        import technician_ai.retrieval as retrieval

        self.database = importlib.reload(database)
        self.retrieval = importlib.reload(retrieval)
        self.database.init_db()
        self.retrieval.EMBEDDINGS_ENABLED = False

    def tearDown(self):
        self.tmp.cleanup()

    def _workspace(self, suffix: str) -> dict:
        return self.database.create_signup_workspace(
            supabase_user_id=f"supabase-{suffix}",
            email=f"{suffix}@example.com",
            organization_name=f"Org {suffix}",
            factory_name=f"Factory {suffix}",
        )

    def test_factory_settings_are_isolated(self):
        factory_a = self._workspace("a")
        factory_b = self._workspace("b")

        self.database.update_factory_llm_settings(
            factory_id=factory_a["factory_id"],
            provider="deepseek",
            model="deepseek-chat",
            base_url="https://api.deepseek.com",
        )
        self.database.update_factory_llm_settings(
            factory_id=factory_b["factory_id"],
            provider="openai",
            model="gpt-4o-mini",
        )

        settings_a = self.database.get_factory_llm_settings(factory_a["factory_id"])
        settings_b = self.database.get_factory_llm_settings(factory_b["factory_id"])

        self.assertEqual(settings_a["llm_provider"], "deepseek")
        self.assertEqual(settings_a["llm_model"], "deepseek-chat")
        self.assertEqual(settings_b["llm_provider"], "openai")
        self.assertEqual(settings_b["llm_model"], "gpt-4o-mini")

    def test_answer_question_uses_current_factory_provider_settings(self):
        factory_a = self._workspace("a")
        factory_b = self._workspace("b")
        self.database.insert_document(
            kind="manual_chunk",
            text="Low vacuum alarm means inspect the vacuum cup.",
            embedding=None,
            metadata={"manual_title": "Vacuum Manual"},
            organization_id=factory_a["organization_id"],
            factory_id=factory_a["factory_id"],
            uploaded_by_user_id=factory_a["user_id"],
        )
        self.database.insert_document(
            kind="manual_chunk",
            text="Low vacuum alarm means check the filter.",
            embedding=None,
            metadata={"manual_title": "Filter Manual"},
            organization_id=factory_b["organization_id"],
            factory_id=factory_b["factory_id"],
            uploaded_by_user_id=factory_b["user_id"],
        )
        self.database.update_factory_llm_settings(
            factory_id=factory_a["factory_id"],
            provider="deepseek",
            model="deepseek-chat",
        )
        self.database.update_factory_llm_settings(
            factory_id=factory_b["factory_id"],
            provider="openai",
            model="gpt-4o-mini",
        )

        configs = []

        def fake_chat(**kwargs):
            configs.append(kwargs["config"])
            return "Mocked answer [#1]"

        with patch.object(self.retrieval.llm_client, "chat", side_effect=fake_chat):
            self.retrieval.answer_question(
                "Machine 3 has a low vacuum alarm.",
                organization_id=factory_a["organization_id"],
                factory_id=factory_a["factory_id"],
                user_id=factory_a["user_id"],
                llm_config=self.database.get_factory_llm_settings(factory_a["factory_id"]),
            )
            self.retrieval.answer_question(
                "Machine 3 has a low vacuum alarm.",
                organization_id=factory_b["organization_id"],
                factory_id=factory_b["factory_id"],
                user_id=factory_b["user_id"],
                llm_config=self.database.get_factory_llm_settings(factory_b["factory_id"]),
            )

        self.assertEqual(configs[0]["llm_provider"], "deepseek")
        self.assertEqual(configs[0]["llm_model"], "deepseek-chat")
        self.assertEqual(configs[1]["llm_provider"], "openai")
        self.assertEqual(configs[1]["llm_model"], "gpt-4o-mini")

    def test_deepseek_uses_openai_compatible_chat_path(self):
        import technician_ai.llm as llm

        calls = []

        class FakeCompletions:
            def create(self, **kwargs):
                calls.append(kwargs)
                return SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))]
                )

        fake_client = SimpleNamespace(
            chat=SimpleNamespace(completions=FakeCompletions())
        )
        with patch.object(llm, "_get_client", return_value=fake_client):
            result = llm.chat(
                system="system",
                user_message="hello",
                model="fallback",
                config={
                    "llm_provider": "deepseek",
                    "llm_model": "deepseek-chat",
                    "llm_base_url": "https://api.deepseek.com",
                },
            )

        self.assertEqual(result, "ok")
        self.assertEqual(calls[0]["model"], "deepseek-chat")

    def test_missing_deepseek_key_returns_clear_error(self):
        import technician_ai.llm as llm

        llm._client_cache.clear()
        with patch.object(llm, "LLM_API_KEY", None), patch.dict(os.environ, {"DEEPSEEK_API_KEY": ""}):
            with self.assertRaisesRegex(RuntimeError, "DEEPSEEK_API_KEY"):
                llm.chat(
                    system="system",
                    user_message="hello",
                    model="fallback",
                    config={"llm_provider": "deepseek", "llm_model": "deepseek-chat"},
                )


if __name__ == "__main__":
    unittest.main()
