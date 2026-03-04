# UrbanFix Web Deploy (Render)

## What is ready
- Web build scripts are added in [frontend/package.json](../frontend/package.json)
- Render blueprint is added in [render.yaml](../render.yaml)

## Deploy steps
1. Push latest code to GitHub.
2. In Render dashboard, choose **New +** -> **Blueprint**.
3. Select your repo and branch.
4. Render auto-detects [render.yaml](../render.yaml) and creates `urbanfix-web` static site.
5. After deploy, open the generated Render URL on any mobile browser.

## Notes
- API for web is already set to Render backend in [frontend/src/services/api.ts](../frontend/src/services/api.ts).
- SPA routing is handled by rewrite `/* -> /index.html` in [render.yaml](../render.yaml).
