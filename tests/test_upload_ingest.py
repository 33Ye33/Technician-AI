import importlib
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from openpyxl import Workbook


class UploadIngestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)
        os.environ["TECHNICIAN_AI_DB"] = os.path.join(self.tmp.name, "tech.db")

        import technician_ai.auth as auth
        import technician_ai.database as database
        import technician_ai.ingestion as ingestion
        import technician_ai.api as api

        self.auth = importlib.reload(auth)
        self.database = importlib.reload(database)
        self.ingestion = importlib.reload(ingestion)
        self.api = importlib.reload(api)
        self.database.init_db()

    def tearDown(self):
        self.api.app.dependency_overrides.clear()
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def _xlsx_bytes(self) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Manual"
        ws.append(["Machine", "Symptom", "Check"])
        ws.append(["Machine 3", "low vacuum alarm", "Inspect vacuum cup and hose"])
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def test_upload_falls_back_when_llm_tagger_fails(self):
        async def fake_writer():
            return self.auth.CurrentTenant(
                user_id="user-a",
                supabase_user_id="supabase-user-a",
                email="a@example.com",
                organization_id="org-a",
                organization_name="Org A",
                factory_id="factory-a",
                factory_name="Factory A",
                role="org_admin",
            )

        self.api.app.dependency_overrides[self.auth.require_writer] = fake_writer

        with (
            patch.object(
                self.ingestion.tagger,
                "tag_content",
                side_effect=RuntimeError("LLM provider unavailable"),
            ),
            TestClient(self.api.app) as client,
        ):
            response = client.post(
                "/api/ingest",
                files={
                    "file": (
                        "factory-manual.xlsx",
                        self._xlsx_bytes(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json()["chunks"], 0)
        self.assertTrue(Path("manuals/factory-a/factory-manual.xlsx").exists())

        manuals = self.database.list_manuals(factory_id="factory-a")
        self.assertEqual(len(manuals), 1)
        self.assertEqual(manuals[0]["title"], "factory-manual")

        files = self.database.list_uploaded_files("factory-a")
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0]["name"], "factory-manual.xlsx")


if __name__ == "__main__":
    unittest.main()
