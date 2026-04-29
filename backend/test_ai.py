import asyncio
from orchestrator.orchestrator import get_orchestrator

async def test():
    o = get_orchestrator()
    async for ev in o.query('salut', 'constructii'):
        print(ev)

asyncio.run(test())
