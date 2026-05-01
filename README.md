# Earl's Portfolio

Personal portfolio website for **Earl Montañez Sumalbag** — a fresh IT graduate looking for opportunities as a Junior Web Developer / Web Designer.

The site is a static HTML/CSS/JS portfolio with a small AI chatbot that answers questions about Earl using Google Gemini.

## Tech

- Static HTML / CSS / JavaScript (no build step)
- AOS, TypeIt, Bootstrap Icons via CDN
- Google Gemini for the chatbot, called from a Vercel serverless function (`/api/chat`)

## Project structure

```
.
├── index.html        # main page + chatbot widget markup
├── style.css         # all styles, including chatbot widget
├── chatbot.js        # frontend chat logic (talks to /api/chat)
├── api/
│   └── chat.js       # Vercel serverless function (Gemini proxy)
├── images/           # photos, certificates, profile
└── README.md
```

## Local preview

Because the chatbot needs the `/api/chat` serverless function, the easiest way to run everything locally is the Vercel CLI:

```bash
npm i -g vercel        # one time
vercel login           # one time
vercel dev             # start local server on http://localhost:3000
```

Set your Gemini API key in a local `.env.local` file:

```
GEMINI_API_KEY=your_key_here
```

> If you only want to preview the static parts (everything except the chatbot), any static server works, e.g. `npx serve .` or `python3 -m http.server`.

## Deploying to Vercel

1. Push this repository to GitHub (already done).
2. Go to <https://vercel.com> and sign in with GitHub.
3. Click **Add New… → Project**, select `erlmntz/my-portfolio`, and click **Import**.
4. Leave the framework preset as **Other**. No build command, no output directory needed (Vercel auto-detects static files + the `api/` folder).
5. Open **Project Settings → Environment Variables** and add:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** your Gemini API key from <https://aistudio.google.com/app/apikey>
   - **Environments:** Production, Preview, Development (all three).
6. Click **Deploy**. Vercel will give you a URL like `https://my-portfolio-xxx.vercel.app`.
7. (Optional) Add a custom domain in **Settings → Domains**.

Every push to the default branch will automatically redeploy.

## How the chatbot works

- The user clicks the floating chat button in the bottom-right corner.
- The chat widget posts the conversation to `/api/chat`.
- `api/chat.js` adds a system prompt with Earl's portfolio info, calls the Gemini REST API, and returns the reply.
- The API key never leaves the server.

To update the information the chatbot knows about Earl, edit the `PORTFOLIO_INFO` constant at the top of `api/chat.js`.
