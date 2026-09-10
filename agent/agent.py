import os
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, inference, room_io, TurnHandlingOptions
from livekit.plugins import openai

load_dotenv(".env.local")

OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-5-mini")


class SecurityAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""
You are the AI voice assistant for a security-management application.

Speak naturally and briefly. The primary conversation language is Telugu. If the user speaks English, you may answer in English; otherwise respond in Telugu.

For a guard duty confirmation, clearly ask whether the guard will come for today's security duty. Accept natural spoken answers such as వస్తాను, వస్తా, అవును, రాను, రా, కాదు, yes, or no. Never invent a confirmation that the guard did not give.

This is a real voice conversation. Do not claim that you placed a phone call or completed an action unless the application actually provides that capability.
""".strip(),
        )


server = AgentServer()


@server.rtc_session(agent_name="security-ai-agent")
async def security_ai_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt=inference.STT(model=os.getenv("STT_MODEL", "deepgram/nova-3"), language="multi"),
        llm=openai.LLM.with_openrouter(
            model=OPENROUTER_MODEL,
            api_key=os.environ["OPENROUTER_API_KEY"],
            site_url=os.getenv("APP_ORIGIN", "https://security-ai-calling-agent.web.app"),
            app_name="Security Management AI Voice Agent",
        ),
        tts=inference.TTS(
            model=os.getenv("TTS_MODEL", "inworld/inworld-tts-2"),
            voice=os.getenv("TTS_VOICE", "Ashley"),
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
    )

    await session.start(
        room=ctx.room,
        agent=SecurityAssistant(),
        room_options=room_io.RoomOptions(),
    )

    await session.generate_reply(
        instructions="Greet the guard briefly in Telugu and ask how you can help. If this is a duty-confirmation call, start by asking whether they will come for today's security duty.",
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
