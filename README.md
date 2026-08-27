# Dutch Tutor

A mobile-first frontend foundation for a personal, conversation-led Dutch learning app. The current experience uses local mock data only; it does not connect to authentication, Supabase, OpenAI, or voice services.

## Run locally

1. Install [Node.js 20.9 or newer](https://nodejs.org/).
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000). To test the phone layout on a computer, use your browser’s responsive mode and select an iPhone-sized viewport.

## Commands

- `npm run dev` — start the local development server
- `npm run lint` — run ESLint
- `npm run typecheck` — check TypeScript
- `npm run build` — create a production build
- `npm start` — serve the production build

## Routes

- `/` — home and session-length selection
- `/session` — mocked tutor conversation and correction
- `/quiz` — five-part practice quiz
- `/review` — weak-vocabulary review
- `/progress` — learning metrics, quiz history, and common mistakes
