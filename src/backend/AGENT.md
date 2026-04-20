# Agent Instructions — Email Request Management Backend

## Project Overview
This is a NestJS backend that receives incoming emails, uses an LLM (Claude) to classify and triage requests, auto-replies when no human is needed, creates tickets when human involvement is required, and exposes APIs for a dashboard to monitor ticket status.

## Tech Stack
- **Runtime:** Node.js + NestJS (TypeScript)
- **Database:** PostgreSQL via Supabase (using Supabase JS client)
- **Cache/Queue:** Redis (BullMQ for job queues)
- **AI:** Anthropic Claude API for classification
- **Email:** Inbound via webhook (e.g., SendGrid Inbound Parse / Mailgun Routes), outbound via nodemailer or SendGrid API
- **Auth:** Supabase Auth (JWT)

## Architecture Principles
- Modular NestJS structure: one module per domain (email, ticket, classification, user, dashboard)
- All email processing is async via BullMQ job queues backed by Redis
- Database access through Supabase client (not raw SQL or TypeORM)
- All LLM calls go through a dedicated `ClassificationService` with structured output parsing
- Every ticket state change is logged in a `ticket_events` table for audit trail
- Use environment variables for all secrets and config (`.env` file, validated at startup with `@nestjs/config` + Joi)

## Directory Structure
```
src/
├── app.module.ts
├── main.ts
├── config/                  # Config module, env validation
│   ├── config.module.ts
│   └── env.validation.ts
├── common/                  # Shared guards, decorators, filters, DTOs
│   ├── guards/
│   ├── filters/
│   ├── decorators/
│   └── dto/
├── supabase/                # Supabase client provider
│   ├── supabase.module.ts
│   └── supabase.service.ts
├── email/                   # Inbound webhook + outbound sending
│   ├── email.module.ts
│   ├── email.controller.ts  # POST /webhooks/inbound-email
│   ├── email.service.ts     # Send emails (replies, ticket links)
│   └── dto/
├── classification/          # LLM classification logic
│   ├── classification.module.ts
│   ├── classification.service.ts
│   ├── prompts/             # System prompts as .txt or constants
│   └── dto/
├── ticket/                  # Ticket CRUD + state machine
│   ├── ticket.module.ts
│   ├── ticket.controller.ts
│   ├── ticket.service.ts
│   └── dto/
├── queue/                   # BullMQ processors
│   ├── queue.module.ts
│   ├── email-processing.processor.ts
│   └── constants.ts
├── department/              # Departments + assignment rules
│   ├── department.module.ts
│   ├── department.controller.ts
│   └── department.service.ts
├── user/                    # User/agent management
│   ├── user.module.ts
│   ├── user.controller.ts
│   └── user.service.ts
└── dashboard/               # Dashboard aggregation APIs
    ├── dashboard.module.ts
    ├── dashboard.controller.ts
    └── dashboard.service.ts
```

## Database Tables (Supabase/PostgreSQL)
- `users` — id, email, full_name, role (admin/agent/requester), department_id, created_at
- `departments` — id, name, description, created_at
- `tickets` — id, subject, body, requester_email, request_type, department_id, assigned_to (FK users), status (open/in_progress/resolved/closed), priority, ai_auto_replied (boolean), ai_classification_raw (jsonb), created_at, updated_at
- `ticket_events` — id, ticket_id, event_type (created/assigned/status_changed/replied), actor (system/user_id), metadata (jsonb), created_at
- `email_logs` — id, ticket_id, direction (inbound/outbound), from_address, to_address, subject, body, raw_payload (jsonb), created_at

## Key Conventions
1. **Controller methods** return standardized response: `{ success: boolean, data: T, message?: string }`
2. **All async processing** goes through BullMQ — the inbound email webhook enqueues a job immediately and returns 200
3. **Classification output** must be parsed as JSON with this shape:
   ```json
   {
     "request_type": "string",
     "needs_human": true/false,
     "department": "string",
     "assigned_to_suggestion": "string or null",
     "priority": "low|medium|high|urgent",
     "auto_reply_message": "string or null",
     "summary": "string"
   }
   ```
4. **Error handling**: use NestJS exception filters globally; queue jobs have 3 retries with exponential backoff
5. **Naming**: camelCase for code, snake_case for DB columns, kebab-case for API routes
6. **Testing**: unit tests for services (especially ClassificationService with mocked LLM), e2e tests for critical flows

## How to Run
```bash
cp .env.example .env   # fill in values
pnpm install
pnpm run start:dev
```

## Non-Obvious Details
- Inbound email webhook must validate sender signature (SendGrid/Mailgun) before processing
- Redis is used for both BullMQ queues AND caching classification results (TTL 1h) to avoid duplicate LLM calls for retry scenarios
- Supabase Row Level Security (RLS) is enabled; the backend uses the service_role key
- The AI prompt includes a list of departments and agents fetched from DB, injected at classification time