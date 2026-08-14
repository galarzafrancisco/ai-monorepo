# 03 — Thread and context aggregates

Depends on: 01, 02.

Implement transactional DB aggregate creation and an outbox-driven external conversation workflow.

- [x] `CreateThread` atomically creates state block, thread, tags, and relation joins; parent-task uniqueness remains a schema invariant.
- [ ] Conversation provisioning is still lazy. Move it to a persisted outbox job with a CAS `chat_session_id IS NULL` claim and provider-side idempotency.
- [x] Thread task attach/detach, context references, participants, tags, title updates, and deletion use transaction-owning commands plus outbox events.
- [x] Context create/update/delete, tag mutations, and append use transaction-owning commands; append uses atomic SQL concatenation.
- [x] Context move/reorder are transaction-owning commands with durable updates.
- [x] Context import now uses an all-or-nothing tree command; a concurrency-safe sibling-ordering scheme remains.
- [x] Human-message persistence is transactional and outbox-backed. Move chat-request dispatch, title generation, and idempotent agent responses to durable workers.

Acceptance criteria: concurrent thread/message/tree operations neither lose writes nor create duplicate conversations; a crash at every DB step leaves either no aggregate or a recoverable provisioning record.
