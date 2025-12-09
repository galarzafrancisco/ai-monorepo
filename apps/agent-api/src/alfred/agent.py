from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

model = LiteLlm(
    model=f"openai/gpt-oss:20b",
)

def get_weather(city: str) -> str:
    """
    Get the weather for a city.
    
    Args:
        city: The city to get the weather for
        
    Returns:
        The weather for the city
    """
    return f"The weather in {city} is sunny."
    
# Agent
root_agent = Agent(
    name="alfred",
    model=model,
    instruction="You are a helpful assistant.",
    tools=[
        get_weather,
    ],
)