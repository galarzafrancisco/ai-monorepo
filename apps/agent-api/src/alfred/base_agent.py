from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from typing import Optional, List, Callable


class BaseAgent:
    """
    A simplified base class for creating ADK agents.

    This class wraps google.adk.agents.Agent with a simpler interface
    that only requires name and instructions, making it easy to create
    agents on the fly.

    Example:
        agent = BaseAgent(
            name="my-agent",
            instructions="You are a helpful assistant."
        )
    """

    def __init__(
        self,
        name: str,
        instructions: str,
        model: Optional[LiteLlm] = None,
        tools: Optional[List[Callable]] = None
    ):
        """
        Initialize a BaseAgent.

        Args:
            name: The name/slug of the agent
            instructions: The instruction prompt for the agent
            model: Optional LiteLlm model. Defaults to gpt-oss:20b if not provided
            tools: Optional list of tool functions to provide to the agent
        """
        # Use default model if none provided
        if model is None:
            model = LiteLlm(model="openai/gpt-oss:20b")

        # Initialize with empty tools list if none provided
        if tools is None:
            tools = []

        # Create the underlying Agent
        self._agent = Agent(
            name=name,
            model=model,
            instruction=instructions,
            tools=tools,
        )

    @property
    def agent(self) -> Agent:
        """Get the underlying google.adk.agents.Agent instance."""
        return self._agent
