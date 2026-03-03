{
  "name": "card-counter-glasses",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "bun run src/index.ts"
  },
  "dependencies": {
    "@mentra/sdk": "latest",
    "openai": "latest"
  }
}
File 2: src/index.ts
import { AppServer, AppSession } from '@mentra/sdk';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CARD_VALUES: Record<string, number> = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
};

const TOTAL_CARDS = 6 * 52;

class CardCounterServer extends AppServer {
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    let runningCount = 0;
    let cardsDealt = 0;

    const getTrueCount = () => {
      const decksRemaining = Math.max(0.5, (TOTAL_CARDS - cardsDealt) / 52);
      return (runningCount / decksRemaining).toFixed(1);
    };

    const getAdvice = (tc: number) => {
      if (tc >= 4) return 'Strong player edge. Bet big.';
      if (tc >= 2) return 'Player advantage. Increase bet.';
      if (tc >= 0) return 'Slight house edge. Bet normal.';
      return 'House advantage. Bet minimum.';
    };

    await session.layouts.showTextWall('Card Counter Ready\nPress button to scan a card');

    session.events.onButtonPress(async () => {
      await session.layouts.showTextWall('Scanning card...');

      try {
        const photo = await session.camera.requestPhoto();

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${photo.base64}` }
              },
              {
                type: 'text',
                text: 'Identify ALL visible playing cards. Return ONLY a JSON array like: ["K","A","7"]. Use 2-9, 10, J, Q, K, A. If no cards, return [].'
              }
            ]
          }],
          max_tokens: 100
        });

        const raw = response.choices[0].message.content ?? '[]';
        const match = raw.match(/\[.*\]/s);
        const cards: string[] = match ? JSON.parse(match[0]) : [];

        if (cards.length === 0) {
          await session.layouts.showTextWall('No cards detected\nTry again');
          await session.audio.speak('No cards detected');
          return;
        }

        for (const card of cards) {
          runningCount += CARD_VALUES[card] ?? 0;
          cardsDealt++;
        }

        const tc = parseFloat(getTrueCount());
        const sign = runningCount >= 0 ? '+' : '';
        const tcSign = tc >= 0 ? '+' : '';
        const advice = getAdvice(tc);

        await session.layouts.showTextWall(
          `Cards: ${cards.join(', ')}\nRunning: ${sign}${runningCount}  True: ${tcSign}${tc}\n${advice}`
        );

        await session.audio.speak(
          `${cards.join(', ')} detected. Running ${sign}${runningCount}. True ${tcSign}${tc}. ${advice}`
        );

      } catch (err) {
        await session.layouts.showTextWall('Error scanning.\nTry again.');
        await session.audio.speak('Error scanning card');
      }
    });
  }
}

new CardCounterServer({
  packageName: process.env.PACKAGE_NAME!,
  apiKey: process.env.MENTRAOS_API_KEY!,
  port: parseInt(process.env.PORT ?? '3000')
});

console.log('Card Counter server running on port 3000');
