# RoomBloom — Netlify-ready AI Home Decor

This version is adapted for Netlify: static HTML/CSS/JavaScript plus a Netlify Function. It does **not** require Flask or Python.

## What you need

- A GitHub account and a Netlify account
- A Hugging Face account/token with permission to use Inference Providers
- A model/provider that currently supports image-to-image for the selected model

Netlify hosting and Functions have free-tier limits, and AI provider access/credits may not be free or guaranteed. The site will show a clear error if the provider rejects a request.

## Deploy to Netlify (recommended)

1. Extract the ZIP on your computer.
2. Put the contents of the extracted `ai_home_decor_netlify` folder into a GitHub repository. `index.html` should be in the repository root.
3. In Netlify, choose **Add new site → Import an existing project**, connect GitHub, and select your repository.
4. Build settings:
   - Build command: leave blank
   - Publish directory: `.`
   - Functions directory: `netlify/functions` (also configured in `netlify.toml`)
5. Before or after the first deploy, open **Site configuration → Environment variables** and add:
   - Key: `HF_TOKEN`
   - Value: your Hugging Face access token
   Optionally add `HF_MODEL` if you use another compatible image-to-image model.
6. Redeploy the site after adding the variable. Open the generated `https://...netlify.app` URL.

**Security:** never put your token in `app.js`, `index.html`, or any `VITE_`/public variable. Do not commit it to GitHub.

## Run locally

Install Node.js, then in this folder run:

```bash
npm install
npx netlify dev
```

Open the local URL printed by Netlify CLI. Add `HF_TOKEN` to your local shell environment before running. For Windows PowerShell:

```powershell
$env:HF_TOKEN="your_token_here"
npx netlify dev
```

## Troubleshooting

- **Page not found:** deploy the extracted folder/repository with `index.html` at its root; do not deploy the ZIP file as a single website file.
- **AI not configured:** set `HF_TOKEN` in Netlify environment variables and redeploy.
- **AI provider error / model not supported:** the selected Hugging Face model or Inference Provider may not support this exact image-to-image request, may be gated, or may require credits. Check the model page and provider availability, then set `HF_MODEL` to a compatible model. Netlify deployment alone does not provide AI image generation.
- **Function not found:** confirm `netlify.toml` and `netlify/functions/generate.js` were committed to the same repository as `index.html`.
- **Large images / timeouts:** use a smaller photo (under 8 MB); serverless functions have execution and payload limits.

## Files

- `index.html`, `style.css`, `app.js`: frontend
- `netlify/functions/generate.js`: server-side API proxy; token stays on the server
- `netlify.toml`: Netlify publish/function settings
