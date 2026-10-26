/**
 * Public UrbanFix backends the app can reach from any network, in priority order.
 *   1. rag-pc behind a Cloudflare tunnel — full stack, including Vertex AI.
 *   2. Render — always on (cold start ~1 min on the free plan); AI features
 *      need Vertex credentials there.
 * A server saved in Settings always wins; the LAN / USB addresses are tried last.
 */
export const REMOTE_SERVERS = [
  'RAGPC_TUNNEL_URL',
  'https://urban-fix-ai.onrender.com',
].filter((u) => /^https:\/\//.test(u));
