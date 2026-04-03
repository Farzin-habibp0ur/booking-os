# Channel Configuration Guide

Booking OS supports 6 messaging channels. This guide documents the exact configuration needed for each channel.

**All webhook URLs use the global prefix:** `https://api.businesscommandcentre.com/api/v1/webhook/...`

---

## Priority Order for Go-Live

1. **Email + Web Chat** — no third-party approval needed, fastest to set up
2. **WhatsApp** — highest value channel, requires Meta Business verification
3. **SMS (Twilio)** — A2P 10DLC registration can take days/weeks for US numbers
4. **Instagram + Facebook** — requires Meta App Review for messaging permissions

---

## 1. Web Chat (Self-Hosted)

No third-party account needed. The widget is built from source and served by the API.

### Build the Widget

```bash
cd packages/web-chat-widget && npm install && npm run build
```

Output: `packages/web-chat-widget/dist/booking-os-chat.js`

### How It's Served

The API serves the widget at:
```
GET https://api.businesscommandcentre.com/api/v1/chat-widget/booking-os-chat.js
```
- CORS: `Access-Control-Allow-Origin: *` (cross-origin embedding allowed)
- Cache: 1-hour browser cache, 60-second in-memory server cache

### Embed Snippet

Add this to your customer's website:

```html
<script src="https://api.businesscommandcentre.com/api/v1/chat-widget/booking-os-chat.js"></script>
<script>
  BookingOSChatModule.init({ businessSlug: 'your-business-slug' });
</script>
```

The widget fetches its configuration from:
```
GET /api/v1/public/chat/config/:businessSlug
```

This returns greeting text, theme color, pre-chat fields, and online status (unauthenticated endpoint).

### Per-Location Configuration

Configure via the `webChatConfig` JSON field on the `Location` model. Accessible in the app at Settings → Channels → Web Chat.

### Environment Variables

None required — web chat runs entirely within the platform.

### Real-Time Architecture

- WebSocket namespace: `/web-chat`
- Session management: UUID-based, Redis-backed with 24-hour TTL
- Events: `chat:start`, `chat:message`, `chat:typing`, `chat:offline`, `session:identify`, `history:request`
- Staff replies bridged to widget via `sendToWebChatClient()` in InboxGateway

---

## 2. Email (Resend)

### Prerequisites

- [Resend](https://resend.com) account
- Verified sending domain with SPF, DKIM, and DMARC records

### Environment Variables

```bash
EMAIL_PROVIDER=resend                              # or 'sendgrid' or 'none' (default, logs only)
EMAIL_API_KEY=re_...                               # Resend API key
EMAIL_FROM=notifications@yourdomain.com            # Verified sender address
SENDGRID_INBOUND_WEBHOOK_SECRET=<secret>           # For inbound email signature verification
```

### Webhook Configuration

**Inbound email webhook:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/email/inbound
```

**Delivery status webhook:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/email/status
```

Configure inbound forwarding in the Resend dashboard to forward incoming emails to the inbound webhook URL.

### Signature Verification

Inbound emails are verified via `x-twilio-email-integrity` header (SHA256 comparison). Delivery status callbacks use the Resend webhook signature.

---

## 3. WhatsApp (Meta Cloud API)

### Prerequisites

- [Meta Business Account](https://business.facebook.com) (verified)
- WhatsApp Business API access via Meta Business Suite
- Facebook App with WhatsApp product configured

### Setup Steps

1. Go to Meta Business Suite → API Setup
2. Get your **Phone Number ID** and generate a **Permanent Access Token**
3. Configure the webhook in your Facebook App → WhatsApp → Configuration

### Webhook Configuration

**Verification (GET — Meta challenge-response):**
```
GET https://api.businesscommandcentre.com/api/v1/webhook/whatsapp
```

**Inbound messages (POST):**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/whatsapp
```

**Delivery status callbacks:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/whatsapp/status
```

**Subscribed webhook fields:** `messages`

### Environment Variables

```bash
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>         # From Meta Business Suite
WHATSAPP_ACCESS_TOKEN=<permanent-access-token>      # From Meta Business Suite
WHATSAPP_VERIFY_TOKEN=<any-random-string>           # Must match Meta webhook config
WHATSAPP_APP_SECRET=<app-secret>                    # Facebook App secret for HMAC signature verification
```

### Signature Verification

Inbound webhooks are verified via `x-hub-signature-256` header using HMAC-SHA256 with `WHATSAPP_APP_SECRET`.

### Multi-Location Support

Each location can have its own WhatsApp configuration via `Location.whatsappConfig` JSON field (phoneNumberId, accessToken). The messaging service lazy-registers per-location providers.

### Test

Send a message to your WhatsApp Business number → verify it appears in the Inbox.

---

## 4. SMS (Twilio)

### Prerequisites

- [Twilio](https://www.twilio.com) account
- Purchased phone number
- **A2P 10DLC registration** (required for US numbers — can take days to weeks)

### Environment Variables

```bash
TWILIO_ACCOUNT_SID=AC...                           # Twilio Account SID
TWILIO_AUTH_TOKEN=<auth-token>                      # Twilio Auth Token
TWILIO_PHONE_NUMBER=+1...                          # Twilio phone number (E.164 format)
TWILIO_WEBHOOK_URL=https://api.businesscommandcentre.com/api/v1/webhook/sms/inbound  # Must match exactly for signature verification
```

### Webhook Configuration

In Twilio Console → Phone Number → Messaging Configuration:

**Inbound messages:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/sms/inbound
```

**Delivery status:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/sms/status
```

### Signature Verification

Twilio webhooks are verified via `x-twilio-signature` header using HMAC-SHA1 with `TWILIO_AUTH_TOKEN` + `TWILIO_WEBHOOK_URL`. The `TWILIO_WEBHOOK_URL` must match exactly what Twilio sends in the request.

### A2P 10DLC Note

For US phone numbers, A2P 10DLC registration is required to send messages at scale. This involves:
1. Brand registration (company details)
2. Campaign registration (use case description)
3. Approval (can take days to weeks)

Without 10DLC registration, messages may be filtered or blocked by carriers.

---

## 5. Instagram (Meta)

### Prerequisites

- Facebook App with `instagram_manage_messages` permission (requires Meta App Review)
- Instagram Business or Creator Account linked to a Facebook Page
- Facebook App approved for Instagram messaging

### OAuth Flow

Users connect Instagram via Settings → Channels → Instagram:
1. Click "Connect Instagram"
2. Redirected to Facebook OAuth consent screen
3. Callback stores access tokens
4. A daily cron job refreshes tokens expiring within 10 days

### Webhook Configuration

**Verification (GET):**
```
GET https://api.businesscommandcentre.com/api/v1/webhook/instagram
```

**Inbound messages (POST):**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/instagram
```

**Delivery status:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/instagram/status
```

### Environment Variables

```bash
INSTAGRAM_APP_ID=<facebook-app-id>                 # Facebook App ID
INSTAGRAM_APP_SECRET=<facebook-app-secret>          # Facebook App Secret (for HMAC verification)
INSTAGRAM_VERIFY_TOKEN=<any-random-string>          # Must match Meta webhook config
```

### Signature Verification

Verified via `x-hub-signature-256` header using HMAC-SHA256 with `INSTAGRAM_APP_SECRET`.

### Ice Breakers

Configure conversation starters via:
```
POST /api/v1/instagram-auth/:locationId/ice-breakers
```

### 24-Hour Messaging Window

Instagram enforces a 24-hour messaging window after the last customer message. The inbox UI shows a countdown and switches to template mode when the window expires.

---

## 6. Facebook Messenger

### Prerequisites

- Facebook Page with Messenger enabled
- Facebook App with `pages_messaging` permission (requires Meta App Review)

### Webhook Configuration

**Verification (GET):**
```
GET https://api.businesscommandcentre.com/api/v1/webhook/facebook
```

**Inbound messages (POST):**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/facebook
```

**Delivery status:**
```
POST https://api.businesscommandcentre.com/api/v1/webhook/facebook/status
```

In the Facebook App Dashboard → Webhooks, subscribe the page to webhook events.

### Environment Variables

```bash
FACEBOOK_VERIFY_TOKEN=<any-random-string>           # Must match Facebook webhook config
FACEBOOK_APP_SECRET=<app-secret>                    # Facebook App Secret (for HMAC verification)
```

### Signature Verification

Verified via `x-hub-signature-256` header using HMAC-SHA256 with `FACEBOOK_APP_SECRET`.

### 24-Hour Messaging Window

Same as Instagram — 24-hour window after last customer message. The inbox UI shows the countdown.

---

## Messaging Provider Architecture

### Provider Switching

The `MESSAGING_PROVIDER` environment variable controls the default provider:

| Value | Behavior |
| ----- | -------- |
| `mock` (default) | Messages are logged but not sent. Development/testing mode. |
| `whatsapp-cloud` | WhatsApp Cloud API as default provider. Other channels use their own providers independently. |

**Important:** Each channel has an independent provider regardless of `MESSAGING_PROVIDER`:
- WhatsApp: `WhatsAppCloudProvider` (registered per phone number ID)
- Instagram: `InstagramProvider` (registered per page ID)
- Facebook: `FacebookProvider` (registered per page ID)
- SMS: `TwilioSmsProvider` (initialized if Twilio credentials present)
- Email: `EmailChannelProvider` (initialized based on `EMAIL_PROVIDER`)
- Web Chat: Native Socket.IO (no external provider)

The `MESSAGING_PROVIDER` only affects the **default fallback** when no channel-specific provider is available.

### Production Configuration

For production, set:
```bash
MESSAGING_PROVIDER=whatsapp-cloud
```

If `MESSAGING_PROVIDER=mock` in production, all channels without explicit provider configuration will log messages instead of sending them. However, channels with their own credentials (Twilio, Instagram, Facebook, Email) will still work independently.

### Circuit Breaker

All outbound message sends are wrapped with a circuit breaker:
- Twilio SMS: 3 failures in 30s → circuit opens for 20s
- All others: 5 failures in 60s → circuit opens for 30s
- Failed messages during open circuit are captured in the Dead Letter Queue (Redis, 7-day TTL)
- Admin DLQ management at `GET/POST/DELETE /api/v1/admin/dlq/*`

---

## Complete Environment Variable Reference

```bash
# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

# Instagram
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_VERIFY_TOKEN=

# Facebook
FACEBOOK_VERIFY_TOKEN=
FACEBOOK_APP_SECRET=

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_URL=

# Email
EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM=
SENDGRID_INBOUND_WEBHOOK_SECRET=

# Provider mode
MESSAGING_PROVIDER=whatsapp-cloud
```

---

## Verification Checklist

- [ ] **Web Chat:** Widget builds (`npm run build`), embed snippet works on test page
- [ ] **Email:** Resend domain verified, inbound webhook forwarding configured, test email round-trip
- [ ] **WhatsApp:** Meta Business verified, webhook challenge passes, test message received in inbox
- [ ] **SMS:** Twilio phone purchased, A2P 10DLC approved, webhook configured, test SMS received
- [ ] **Instagram:** App Review approved, OAuth flow works, test DM received in inbox
- [ ] **Facebook:** App Review approved, page subscribed to webhooks, test message received

---

## Messaging Architecture

> This section documents how BookingOS's omnichannel messaging system works internally. For channel *setup*, see the sections above.

### Key Services

- `CustomerIdentityService` (`modules/customer-identity/`) — resolves customers across channels by priority (phone → email → facebookPsid → instagramUserId → webChatSessionId), links identifiers, reports available channels, merges duplicate customers (`mergeCustomers`), finds open conversations across channels (`findConversation`). Validates phone (E.164) and email format before lookup.
- `CircuitBreakerService` (`common/circuit-breaker/`) — wraps all outbound provider.sendMessage() calls with CLOSED→OPEN→HALF_OPEN state machine. Per-provider configurable thresholds (twilio-sms: 3 failures/30s, default: 5/60s). Emits `circuit:state-change` WebSocket events. Redis-backed with in-memory fallback. On CircuitOpenException, messages are stored as FAILED and captured to DLQ.
- `DeadLetterQueueService` (`common/queue/dead-letter.service.ts`) — captures failed messaging jobs in Redis hash keys `dlq:msg:{id}` with 7-day TTL. Admin API at `/admin/dlq/*`
- `UsageService` (`modules/usage/`) — tracks per-channel message counts in `MessageUsage` model (with `segments` and `cost` fields) for billing. Records inbound usage in webhook controller, outbound usage in MessageService. Reports to Stripe via `billing.meterEvents.create()`. Cross-business aggregation via `getAllBusinessUsage()`. Rates: SMS $0.0079/segment out, $0.0075 in; MMS $0.02; Email $0.00065; WA/IG/FB/Web $0

### Key Patterns

- `Message.channel` is denormalized from `Conversation.channel` — set at creation time for query efficiency
- `Conversation.lastInboundChannel` tracks the channel of the most recent inbound message — persisted by `processInboundMessage()` in webhook controller, used by `getDefaultReplyChannel()` for smart reply channel selection
- Each channel gets its own conversation by default. `CustomerIdentityService.findConversation()` enables unified thread lookup across channels for future cross-channel merging.
- `Business.channelSettings` JSON stores enabled channels, default reply channel, and autoDetectChannel flag
- `Location` has per-channel config JSON fields: `whatsappConfig`, `instagramConfig`, `facebookConfig`, `smsConfig`, `emailConfig`, `webChatConfig`
- All webhook endpoints verify provider signatures (HMAC-SHA256 for WhatsApp/Instagram/Facebook/Email, HMAC-SHA1 for Twilio SMS) using timing-safe comparison
- All 6 channels have delivery status callback endpoints (WhatsApp, SMS, Instagram, Facebook, Email via Resend webhooks)
- `EmailChannelProvider.validateDomain()` performs real DNS validation (MX records, SPF via TXT, DMARC via `_dmarc.` TXT) with 1-hour cache. Soft validation — logs warnings but never blocks message sending. Timeout returns `valid: true` with "timeout" status

### WebChat Gateway

- WebChat gateway on `/web-chat` namespace — visitor sessions (Redis-backed with in-memory fallback, 24h TTL), pre-chat forms, real-time messaging bridge to staff inbox
- Supports `session:identify` (link visitor to customer), `history:request` (paginated message history), `file:upload-request` (base64 upload with validation: 5MB max, PNG/JPEG/GIF/PDF, local filesystem storage)
- Offline visitors with email get notification logging
- `PublicBookingController` at `GET /public/:slug` — unauthenticated booking portal with fuzzy slug resolution: exact match → `startsWith` fallback (single candidate) → suffix-stripped match (strips `-clinic`, `-spa`, `-studio`, `-salon`, `-group`, `-center`, `-centre`). Returns 404 only when no match or multiple ambiguous matches
- `PublicChatController` at `GET /public/chat/config/:businessSlug` — unauthenticated endpoint for widget bootstrapping (greeting, theme, preChatFields, offlineMessage)

### UI Components (in `apps/web/src/components/inbox/`)

- `ChannelBadge` — colored icon+label badge per channel, used on conversation cards and thread headers
- `ReplyChannelSwitcher` — dropdown to switch reply channel with disabled channel support (custom styled tooltips with fixable reason CTAs: "Add email"/"Add phone"), `getDefaultReplyChannel()` helper, `onAddContact` callback for inline contact addition
- `ChannelsOnFile` — sidebar listing customer's available channels with inline "Add email"/"Add phone" forms (E.164 and email format validation), wired into inbox right sidebar
- `ChannelFilterBar` — 7-tab filter (ALL + 6 channels) with unread count badges, `role="tablist"` accessibility
- `ConversationContextBar` — compact bar showing FB/IG/WA messaging window countdown, email subject, SMS opt-in/out status, WhatsApp "Use template" CTA when window expired
- `MediaComposer` — file attachment with per-channel type/size validation, drag-drop with channel-colored feedback, "Switch to Email" fallback on validation errors, inline error alerts
- `DeliveryStatus` — message delivery status indicators (sent=single check, delivered=double check, read=blue double check, failed=red alert with `role="alert"`)

### Inbox UX Features (in `apps/web/src/app/inbox/page.tsx`)

- **Adaptive composer** — morphs per channel: email subject line, SMS char counter + segment calculator, Instagram 1000-char limit, WhatsApp template mode when window expired, Web Chat online/offline indicator
- **Channel pills** — `role="tablist"` with `aria-selected`/`aria-disabled`, keyboard nav (ArrowLeft/ArrowRight), colored active ring, grayscale disabled state, health dots (amber=degraded, red=down), blue draft dots, pin icon
- **Draft persistence** — per-channel drafts keyed by `conversationId:channel`, email preserves subject+body, blue dot indicators on pills, discard confirmation dialog (`role="alertdialog"`) on conversation switch, cleared on send. Debounced auto-save to backend `OutboundDraft` (1.5s) via `PUT /outbound/draft/auto-save`; restored from backend on conversation select for cross-session persistence
- **Channel pinning** — pin icon on active pill, persisted to `localStorage('bookingos:pinnedChannel')`, auto-select priority: pinned > lastInbound > conversation channel > first available
- **Smart suggestions** — proactive nudges between context bar and pills: SMS opted-out, IG/FB window expiring, no response >24h; dismissible with X (per-conversation, persists across conversation switches within session)
- **Failed send recovery** — `role="alert"` error panel with Retry + "Send via [alt channel]" buttons
- **Compact mode** — `isCompact` at screen height <800px (reduced padding, 35vh max), pills collapse to `<select>` dropdown at composer width <640px via ResizeObserver
- **Conversation list sorting** — Web Chat LIVE sessions sorted to top, then urgency (expiring IG/FB windows), then server order
- **ARIA accessibility** — `role="tablist"`/`role="tab"` on pills, `aria-live="assertive"` for channel switch announcements, `role="separator"` on channel transition dividers, `role="alert"` on failed sends, `role="alertdialog"` on discard modal with `aria-labelledby`/`aria-describedby`
- **AI draft display** — OutboundDraft bubbles (bg-indigo-50, dashed border) with Approve & Send / Edit / Reject / Regenerate buttons. "AI is thinking..." indicator during processing. Source badges (AI Draft / Agent Draft). Confidence dot (green/amber/red). Regenerate-with-context input.
- **AI × composer integration** — Edit loads draft into composer with correct channel + editing banner ("Editing AI draft — intent: X") + confidence indicator. Channel switch prompts "Regenerate for [channel]?" when editing AI draft. AI draft appears as first option in quick replies picker.
