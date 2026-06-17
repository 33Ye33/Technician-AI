import importlib
import sys

#if the LLM provider is set in the .env file, it should be resolved on import
#this test ensures that the users .env file is correctly loaded

def test_llm_resolves_provider_from_dotenv_on_import(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("LLM_PROVIDER=google\n", encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    sys.modules.pop("technician_ai.llm", None)
    llm = importlib.import_module("technician_ai.llm")

    assert llm.LLM_PROVIDER == "google"



#testing a git push