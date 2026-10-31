# Security steering

- Never add wallet connect, seed prompts, or KYC.
- Feed fetch allowlist: http(s) only; block localhost / private IP ranges / `.local`.
- Do not execute feed content; treat XML/HTML as data.
- Cap stored summaries (e.g. 4k chars) to avoid blob abuse.
- No API keys required for the core demo; optional LLM via local MCP only.
