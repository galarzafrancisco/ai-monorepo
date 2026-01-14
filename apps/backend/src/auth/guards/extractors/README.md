Purpose: the unified auth context you attach to request / response locals.Purpose: pure functions/classes that extract tokens from a request.

bearer-token.extractor.ts

looks only at Authorization: Bearer ...

cookie-token.extractor.ts

looks only at cookie key(s)

token-extractor.interface.ts

interface like extract(req): { token?: string; source: 'bearer'|'cookie'|... }

Why: guards become orchestration, not parsing.