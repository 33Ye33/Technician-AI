"""
TechnicianAI — Core assistant logic.
Handles user queries and routes them to the appropriate handler.
"""

from src.knowledge_base import KnowledgeBase
from src.diagnostics import DiagnosticEngine


class TechnicianAI:
    def __init__(self):
        self.kb = KnowledgeBase()
        self.diagnostics = DiagnosticEngine()
        self.history = []

    def respond(self, query: str) -> str:
        """Process a user query and return a response."""
        self.history.append({"role": "user", "content": query})

        query_lower = query.lower()

        # Route to diagnostics if it sounds like a problem report
        if any(kw in query_lower for kw in ["error", "broken", "not working", "fail", "issue", "problem", "crash"]):
            response = self.diagnostics.diagnose(query)
        else:
            # Otherwise look up knowledge base
            response = self.kb.lookup(query)

        self.history.append({"role": "assistant", "content": response})
        return response
