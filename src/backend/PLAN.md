# Implementation Plan — Email Request Management Backend

## Phase 1: Project Scaffold & Core Infrastructure
> Goal: Running NestJS app with config, Supabase, and Redis connected.

- [ ] **1.1** Initialize NestJS project with `pnpm`
  - `nest new email-request-backend --package-manager pnpm`
  - Add dependencies: `@nestjs/config`, `@nestjs/bullmq`, `bullmq`, `ioredis`, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `joi`, `nodemailer`
- [ ] **1.2** Create `ConfigModule` with Joi validation for env vars:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_HOST`, `REDIS_PORT`, `ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`, `SYSTEM_EMAIL`, `FRONTEND_URL`
- [ ] **1.3** Create `SupabaseModule` — provides singleton `SupabaseClient` using service_role key
- [ ] **1.4** Create `QueueModule` — registers BullMQ with Redis connection, defines `email-processing` queue
- [ ] **1.5** Create `.env.example` with all required variables documented
- [ ] **1.6** Set up global exception filter and response interceptor

## Phase 2: Database Schema
> Goal: All tables created in Supabase with RLS policies.

- [ ] **2.1** Write SQL migration for `departments` table, seed default departments (IT, HR, Finance, General)
- [ ] **2.2** Write SQL migration for `users` table with role enum and department FK
- [ ] **2.3** Write SQL migration for `tickets` table with status enum, priority enum, ai fields
- [ ] **2.4** Write SQL migration for `ticket_events` table
- [ ] **2.5** Write SQL migration for `email_logs` table
- [ ] **2.6** Add RLS policies: service_role bypasses all; authenticated users see own tickets or department tickets if agent/admin
- [ ] **2.7** Create `supabase/migrations/` directory, store all SQL files there

## Phase 3: Email Ingestion
> Goal: Receive inbound emails via webhook and enqueue for processing.

- [ ] **3.1** Create `EmailModule` with controller and service
- [ ] **3.2** Implement `POST /webhooks/inbound-email` endpoint
  - Parse SendGrid inbound parse payload (from, to, subject, text, html)
  - Validate webhook signature
  - Save raw email to `email_logs` table (direction=inbound)
  - Enqueue `email-processing` job with email data
  - Return 200 immediately
- [ ] **3.3** Create DTOs for inbound email payload with class-validator
- [ ] **3.4** Write unit tests for email controller (mock queue)

## Phase 4: AI Classification
> Goal: LLM classifies email and returns structured JSON.

- [ ] **4.1** Create `ClassificationModule` and `ClassificationService`
- [ ] **4.2** Build system prompt in `classification/prompts/`:
  - Instruct Claude to classify email into request type, department, priority
  - Instruct Claude to decide if human involvement is needed
  - Instruct Claude to suggest assignee from provided agent list
  - Instruct Claude to generate auto-reply if no human needed
  - Require JSON output matching the defined schema
- [ ] **4.3** Implement `ClassificationService.classify(email, departments, agents)`:
  - Fetch departments and agents from Supabase
  - Call Anthropic Claude API with system prompt + email content
  - Parse and validate JSON response
  - Cache result in Redis keyed by email hash (TTL 1h)
  - Return typed classification result
- [ ] **4.4** Write unit tests with mocked Anthropic client (test various email types: password reset, complaint, invoice query, spam)

## Phase 5: Email Processing Queue Worker
> Goal: Process queued emails end-to-end — classify, create ticket or auto-reply.

- [ ] **5.1** Create `EmailProcessingProcessor` (BullMQ processor)
- [ ] **5.2** Implement processing flow:
  ```
  1. Receive job with email data
  2. Call ClassificationService.classify()
  3. IF needs_human == false:
     a. Create ticket with status=resolved, ai_auto_replied=true
     b. Log ticket_event (created, actor=system)
     c. Send auto-reply email to requester with ai_reply_message
     d. Log outbound email to email_logs
  4. IF needs_human == true:
     a. Create ticket with status=open, assigned_to from classification
     b. Log ticket_event (created, actor=system)
     c. Log ticket_event (assigned, actor=system)
     d. Send email to requester with ticket link: {FRONTEND_URL}/tickets/{id}
     e. Log outbound email to email_logs
  ```
- [ ] **5.3** Implement retry logic: 3 retries, exponential backoff, dead-letter queue for failures
- [ ] **5.4** Write integration test for full flow (mock LLM + email sending)

## Phase 6: Ticket Management APIs
> Goal: CRUD APIs for tickets consumed by the dashboard.

- [ ] **6.1** Create `TicketModule` with controller and service
- [ ] **6.2** Implement endpoints:
  - `GET /tickets` — list tickets with filters (status, department, assigned_to, date range), pagination, sorting
  - `GET /tickets/:id` — single ticket with events timeline
  - `PATCH /tickets/:id` — update status, assignee, priority
  - `GET /tickets/:id/events` — ticket event history
- [ ] **6.3** Add Supabase Auth guard — validate JWT from `Authorization` header
- [ ] **6.4** Implement role-based access:
  - `requester` sees only own tickets (matched by email)
  - `agent` sees tickets in own department
  - `admin` sees all
- [ ] **6.5** On status change, insert `ticket_event` and optionally notify requester via email
- [ ] **6.6** Write DTOs with validation, write unit tests

## Phase 7: Department & User APIs
> Goal: Manage departments and agents.

- [ ] **7.1** Create `DepartmentModule` — `GET /departments`, `POST /departments` (admin only)
- [ ] **7.2** Create `UserModule` — `GET /users`, `GET /users/agents` (agents list for assignment), `PATCH /users/:id`
- [ ] **7.3** Add admin-only guard for write operations

## Phase 8: Dashboard Aggregation APIs
> Goal: Provide stats for the dashboard.

- [ ] **8.1** Create `DashboardModule`
- [ ] **8.2** Implement `GET /dashboard/stats`:
  - Total tickets (by status)
  - Tickets created today/this week/this month
  - Average resolution time
  - Auto-resolved vs human-resolved ratio
  - Tickets per department
- [ ] **8.3** Implement `GET /dashboard/recent-activity` — latest ticket events
- [ ] **8.4** Cache dashboard stats in Redis (TTL 5min)

## Phase 9: Email Outbound Service
> Goal: Reliable email sending with templates.

- [ ] **9.1** Implement `EmailService.sendTicketCreatedNotification(ticket)` — sends ticket link to requester
- [ ] **9.2** Implement `EmailService.sendAutoReply(email, replyMessage)` — sends AI-generated reply
- [ ] **9.3** Implement `EmailService.sendStatusUpdateNotification(ticket, newStatus)` — notifies requester of progress
- [ ] **9.4** Use simple HTML templates (inline, no template engine needed)

## Phase 10: Testing & Hardening
> Goal: Confidence in production readiness.

- [ ] **10.1** E2E test: inbound email → classification → ticket created → API returns it
- [ ] **10.2** E2E test: inbound email → auto-reply flow
- [ ] **10.3** Add rate limiting on webhook endpoint (throttler)
- [ ] **10.4** Add health check endpoint `GET /health` (DB + Redis connectivity)
- [ ] **10.5** Add request logging middleware
- [ ] **10.6** Swagger/OpenAPI setup via `@nestjs/swagger`

## Phase 11: Deployment Prep
> Goal: Ready to deploy.

- [ ] **11.1** Create `Dockerfile` (multi-stage build)
- [ ] **11.2** Create `docker-compose.yml` (app + Redis, Supabase is external)
- [ ] **11.3** Document deployment steps in README.md
- [ ] **11.4** Configure SendGrid/Mailgun inbound parse webhook to point to `/webhooks/inbound-email`