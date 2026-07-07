import importlib
import os
import tempfile
import unittest


class TenantIsolationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TECHNICIAN_AI_DB"] = os.path.join(self.tmp.name, "tech.db")

        import technician_ai.database as database

        self.database = importlib.reload(database)
        self.database.init_db()

    def tearDown(self):
        self.tmp.cleanup()

    def test_signup_workspace_creates_org_factory_membership(self):
        context = self.database.create_signup_workspace(
            supabase_user_id="supabase-user-a",
            email="a@example.com",
            organization_name="Org A",
            factory_name="Factory A",
        )

        self.assertEqual(context["email"], "a@example.com")
        self.assertEqual(context["organization_name"], "Org A")
        self.assertEqual(context["factory_name"], "Factory A")
        self.assertEqual(context["role"], "org_admin")

        fetched = self.database.get_user_context_by_supabase_id("supabase-user-a")
        self.assertEqual(fetched["factory_id"], context["factory_id"])

    def test_documents_and_conversations_are_factory_scoped(self):
        org_a = "org-a"
        factory_a = "factory-a"
        org_b = "org-b"
        factory_b = "factory-b"

        doc_a = self.database.insert_document(
            kind="manual_chunk",
            text="Factory A secret low vacuum procedure.",
            embedding=None,
            metadata={"manual_title": "Factory A Manual"},
            organization_id=org_a,
            factory_id=factory_a,
            uploaded_by_user_id="user-a",
        )
        self.database.insert_document(
            kind="manual_chunk",
            text="Factory B conveyor reset procedure.",
            embedding=None,
            metadata={"manual_title": "Factory B Manual"},
            organization_id=org_b,
            factory_id=factory_b,
            uploaded_by_user_id="user-b",
        )

        results_a = self.database.search_by_keywords(
            "low vacuum",
            factory_id=factory_a,
        )
        results_b = self.database.search_by_keywords(
            "low vacuum",
            factory_id=factory_b,
        )
        self.assertEqual([r["id"] for r in results_a], [doc_a])
        self.assertNotIn(doc_a, [r["id"] for r in results_b])

        conv_a = self.database.insert_conversation(
            "Factory A question",
            "Factory A answer",
            [doc_a],
            organization_id=org_a,
            factory_id=factory_a,
            user_id="user-a",
        )
        self.database.insert_conversation(
            "Factory B question",
            "Factory B answer",
            [],
            organization_id=org_b,
            factory_id=factory_b,
            user_id="user-b",
        )

        listed_a = self.database.list_conversations(factory_id=factory_a)
        listed_b = self.database.list_conversations(factory_id=factory_b)
        self.assertEqual([c["id"] for c in listed_a], [conv_a])
        self.assertEqual(len(listed_b), 1)
        self.assertNotEqual(listed_b[0]["id"], conv_a)


if __name__ == "__main__":
    unittest.main()
