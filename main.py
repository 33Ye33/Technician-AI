"""
Technician-AI — Entry point
Run this file to start the AI assistant.
"""

from src.assistant import TechnicianAI


def main():
    print("=" * 50)
    print("  Welcome to Technician-AI")
    print("  Your intelligent technical support assistant")
    print("=" * 50)
    print("Type 'exit' or 'quit' to stop.\n")

    ai = TechnicianAI()

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("exit", "quit"):
            print("Goodbye!")
            break
        if not user_input:
            continue
        response = ai.respond(user_input)
        print(f"\nTechnician-AI: {response}\n")


if __name__ == "__main__":
    main()
