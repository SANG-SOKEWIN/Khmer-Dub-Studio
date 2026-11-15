import asyncio
import json
import sys

import edge_tts


async def main():
    request = json.load(sys.stdin)
    speech = edge_tts.Communicate(request["text"], request["voice"])
    async for chunk in speech.stream():
        if chunk["type"] == "audio":
            sys.stdout.buffer.write(chunk["data"])


asyncio.run(main())
