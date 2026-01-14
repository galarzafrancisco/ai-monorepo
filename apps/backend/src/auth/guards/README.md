# NestJS Auth fundamentals

HTTP request
↓
Guard (can we enter the handler at all?) > delegates to extractor > validator.
↓
Interceptor (wrap/transform; runs before and after handler)
↓
Pipe (validate/transforms params/body)
↓
Controller handler
↓
Exception filter (if anything throws)

# Guard
The gatekeeper. Returns true (allowed) or throws.
Can be applied globally, controller wide, route level.
Scope: is this request allowed to enter?
Common patterns:
- extract token/credentials from request (delegate to extractor)
- validate token (delegate to validator/service)
- attach a context to the request for the controller to use (see decorator below)
- can enforce policy, but it's better to delegate that to other guard

# Decorator
Convenience. Should be dumb.
- reads the auth context from request (was injected by the guard)
- returns in a typed way
```typescript
someRoute(@CurrentUser() user: UserClaims)
```

# Context
Where the guard puts the results. Typically `req.user`, `req.auth`, `req.locals.auth`
Usually includes raw token, claims, scopes, user.

# Extractors
Pure logic. From an authorization header or a cookie or a query param or anything.

# Policy
Is this identity allowed to perform this action?
Check scopes, wether the user is admin, ownership of resources, etc.
Implemented as decorators too.
```typescript
@RequireScopes('task:write')
```

# Exception filter
Normally you'd throw UnauthorizedException. But for special cases like MCP where
you want a special surface, you'd use a special filter that convers a normal error into an MCP error.