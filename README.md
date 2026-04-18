# Technician-AI

An intelligent AI-powered technical support assistant that helps diagnose errors, answer common IT questions, and guide users through troubleshooting steps.

---

## Features

- **Smart routing** — automatically detects whether your query is a problem report or a general question
- **Diagnostic engine** — identifies common error types (BSOD, kernel panic, HTTP errors, memory issues, etc.) and suggests fixes
- **Knowledge base** — answers common IT questions about WiFi, Bluetooth, printers, passwords, viruses, and more
- **Extensible** — easily add your own knowledge entries or connect to an LLM (OpenAI, Anthropic, etc.)

---

## Project Structure

```
Technician-AI/
├── main.py               # Entry point — run this to start the assistant
├── requirements.txt      # Python dependencies
├── README.md
├── src/
│   ├── assistant.py      # Core assistant logic and query routing
│   ├── knowledge_base.py # Stores and retrieves technical answers
│   └── diagnostics.py    # Diagnoses error reports
├── config/
│   └── settings.py       # App configuration
├── tests/
│   └── test_assistant.py # Unit tests
└── data/                 # Reserved for future datasets or logs
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/abbyxu009-glitch/Technician-AI.git
cd Technician-AI
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the assistant

```bash
python main.py
```

### 4. Run tests

```bash
pytest tests/
```

---

## Example Usage

```
Welcome to Technician-AI
Your intelligent technical support assistant
Type 'exit' or 'quit' to stop.

You: my computer keeps crashing with a blue screen error
Technician-AI: Diagnosis: A blue screen (BSOD) usually indicates a hardware or driver issue...

You: how do I fix my wifi?
Technician-AI: To fix WiFi issues: restart your router, forget and reconnect to the network...
```

---

## Extending the Knowledge Base

Open `src/knowledge_base.py` and add entries to the `self.data` dictionary:

```python
self.data["your topic"] = "Your answer here."
```

## Connecting an LLM

To power responses with an LLM (e.g., Claude or GPT-4), update `src/assistant.py` to call your preferred API in the `respond()` method. Uncomment the relevant lines in `requirements.txt` and `config/settings.py`.

---

## License

MIT
