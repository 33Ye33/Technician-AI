"""
KnowledgeBase — Stores and retrieves technical information.
Extend this with your own data or connect to an external API/LLM.
"""


class KnowledgeBase:
    def __init__(self):
        # Seed with common technical topics
        self.data = {
            "wifi": "To fix WiFi issues: restart your router, forget and reconnect to the network, or update your network adapter drivers.",
            "bluetooth": "For Bluetooth problems: toggle Bluetooth off and on, remove paired devices and re-pair, or update drivers.",
            "slow computer": "To speed up your computer: clear temp files, disable startup programs, check for malware, or upgrade your RAM.",
            "printer": "Printer not working? Check the connection, restart the print spooler service, and ensure drivers are up to date.",
            "update": "To update your system: go to Settings > Windows Update (Windows) or System Preferences > Software Update (Mac).",
            "password": "To reset a password: use the 'Forgot Password' option, or contact your IT administrator for account recovery.",
            "virus": "If you suspect a virus: run a full scan with your antivirus software, disconnect from the internet, and avoid opening suspicious files.",
        }

    def lookup(self, query: str) -> str:
        """Find the best matching knowledge base entry."""
        query_lower = query.lower()
        for keyword, answer in self.data.items():
            if keyword in query_lower:
                return answer
        return (
            "I don't have a specific answer for that yet. "
            "Please describe your issue in more detail, or consult your IT documentation. "
            "You can also extend my knowledge base in `src/knowledge_base.py`."
        )
