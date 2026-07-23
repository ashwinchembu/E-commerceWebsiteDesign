# Deployment

- This project deploys only through the GitHub repository configured as `origin` and its connected Render service.
- Do not create, update, save, or deploy an OpenAI Sites project for this repository.
- Before deployment, run the same production command Render uses: `npm ci && npm run build`.
- Deploy by committing the intended source changes and pushing `main` to `origin`, then verify the Render build.
