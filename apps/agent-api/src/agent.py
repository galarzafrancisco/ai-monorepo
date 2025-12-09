"""Simple ADK Agent"""

from google.adk.agents import Agent

# Create the root agent
root = Agent(
    name="SimpleAgent",
    model="gemini-1.5-flash",
    instruction="You are a helpful assistant that can answer questions and help with tasks.",
)
