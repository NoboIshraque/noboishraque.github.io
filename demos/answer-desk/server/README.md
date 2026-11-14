# AI answer desk server

`worker.js` is a Cloudflare Worker. It keeps the Claude API key secret and answers questions for `demos/answer-desk/` using only the passages the page sends.

Setup (about 10 minutes):

1. Get a Claude API key at platform.claude.com, add a few dollars of credit, and set a monthly spend limit.
2. In Cloudflare, create a Worker, open its code editor, replace everything with `worker.js`, and deploy.
3. In the Worker's Settings > Variables and Secrets, add a **Secret** named `ANTHROPIC_API_KEY` with the key.
4. Open `https://<your-worker>.workers.dev/health`. It should show `{"ok":true,...}`.
5. Put that worker address in `API_URL` near the top of the script in `demos/answer-desk/index.html`.

Limits built in: 20 questions per visitor per 10 minutes, 300 per day per server instance, questions up to 400 characters, answers up to 1,500 tokens. Model: `claude-haiku-5-5`.
