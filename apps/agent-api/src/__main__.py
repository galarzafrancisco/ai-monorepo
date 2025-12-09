"""ADK Agent API - Main entry point for running the agent"""

from adk import Agent

# Create a simple agent
agent = Agent(
    name="SimpleAgent",
    model="gpt-4",
    instruction="You are a helpful assistant that can answer questions and help with tasks.",
)

if __name__ == "__main__":
    # Start the agent server
    agent.run()
