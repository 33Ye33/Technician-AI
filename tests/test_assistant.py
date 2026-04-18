"""
Basic tests for Technician-AI.
Run with: pytest tests/
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.assistant import TechnicianAI
from src.knowledge_base import KnowledgeBase
from src.diagnostics import DiagnosticEngine


def test_knowledge_base_lookup():
    kb = KnowledgeBase()
    result = kb.lookup("my wifi is not connecting")
    assert "WiFi" in result or "wifi" in result.lower()


def test_diagnostics_blue_screen():
    engine = DiagnosticEngine()
    result = engine.diagnose("I'm getting a blue screen error")
    assert "BSOD" in result or "blue screen" in result.lower()


def test_assistant_routes_to_diagnostics():
    ai = TechnicianAI()
    response = ai.respond("my app keeps crashing with an error")
    assert isinstance(response, str) and len(response) > 0


def test_assistant_routes_to_kb():
    ai = TechnicianAI()
    response = ai.respond("how do I fix my wifi")
    assert isinstance(response, str) and len(response) > 0


def test_unknown_query():
    kb = KnowledgeBase()
    result = kb.lookup("quantum entanglement in production systems")
    assert "don't have a specific answer" in result
