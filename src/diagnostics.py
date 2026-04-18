"""
DiagnosticEngine — Interprets error reports and suggests fixes.
"""


class DiagnosticEngine:
    def __init__(self):
        self.known_errors = {
            "blue screen": "A blue screen (BSOD) usually indicates a hardware or driver issue. Note the error code, update your drivers, and run `sfc /scannow` in Command Prompt.",
            "kernel panic": "A kernel panic is macOS's equivalent of a BSOD. Restart your Mac, then run Disk Utility's First Aid to check for disk errors.",
            "404": "HTTP 404 means the page or resource was not found. Check the URL, clear your browser cache, or contact the website administrator.",
            "500": "HTTP 500 is a server-side error. Try refreshing the page. If it persists, the server may be down — check the service's status page.",
            "out of memory": "Out of memory error: close unused applications, restart the device, or consider increasing your RAM or swap space.",
            "disk full": "Your disk is full. Delete unused files, empty the trash, or move data to external storage or the cloud.",
            "permission denied": "Permission denied error: check that you have the correct file/folder permissions. On Linux/Mac, use `chmod` or `sudo`. On Windows, check folder Properties > Security.",
            "connection refused": "Connection refused: the server may be down or the port is blocked. Check the server status and firewall settings.",
            "timeout": "Connection timeout: check your internet connection, the server status, or try again later.",
        }

    def diagnose(self, query: str) -> str:
        """Match error keywords and return a diagnosis."""
        query_lower = query.lower()
        for error_key, fix in self.known_errors.items():
            if error_key in query_lower:
                return f"Diagnosis: {fix}"

        return (
            "I detected a potential issue in your description. "
            "Please share any error codes or messages you see, and I'll provide a more specific diagnosis. "
            "In the meantime: restart the affected service, check system logs, and ensure all software is up to date."
        )
