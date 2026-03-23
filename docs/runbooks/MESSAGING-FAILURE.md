# Runbook: Messaging Failure

## Symptoms

- Outbound messages not being delivered
- `message:status` WebSocket events showing `FAILED`
- Circuit breaker tripped (WebSocket event `circuit:state-change` → OPEN)
- DLQ entries accumulating
- Customer complaints about not receiving WhatsApp/SMS/email replies

## Diagnosis

### 1. Check Circuit Breaker State

The admin messaging dashboard shows per-provider circuit breaker status:
- `GET /admin/messaging-console/health` — overall messaging health
- WebSocket `circuit:state-change` events show real-time state transitions

Circuit breaker thresholds:
- **Twilio SMS**: 3 failures in 30 seconds → OPEN (20s cooldown)
- **All other providers**: 5 failures in 60 seconds → OPEN (20s cooldown)

### 2. Check Per-Channel Status

**WhatsApp:**
```bash
# Check API logs for WhatsApp errors
railway logs --service api | grep -i "whatsapp\|meta\|graph.facebook"
```
- Verify `WHATSAPP_ACCESS_TOKEN` hasn't expired (Meta tokens expire every 60 days)
- Check Meta Business platform for restrictions: https://business.facebook.com

**SMS (Twilio):**
```bash
railway logs --service api | grep -i "twilio"
```
- Check Twilio dashboard for account suspension or balance: https://console.twilio.com
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are valid

**Instagram DM:**
- Check if Instagram app is still connected
- Verify `INSTAGRAM_APP_SECRET` in environment
- 24-hour messaging window may have expired for the conversation

**Email (Resend/SendGrid):**
```bash
railway logs --service api | grep -i "resend\|sendgrid\|email"
```
- Check Resend dashboard: https://resend.com/emails
- Verify `EMAIL_API_KEY` is valid and sending domain is verified

### 3. Check Dead Letter Queue

```bash
# List failed messages
curl -H "Authorization: Bearer $TOKEN" \
  https://api.businesscommandcentre.com/api/v1/admin/dlq/messages

# Count by channel
curl -H "Authorization: Bearer $TOKEN" \
  https://api.businesscommandcentre.com/api/v1/admin/dlq/messages | jq 'group_by(.channel) | map({channel: .[0].channel, count: length})'
```

## Recovery Steps

### If Circuit Breaker is OPEN

1. The circuit breaker auto-recovers after 20 seconds (HALF_OPEN state)
2. If it keeps tripping, the underlying provider has an issue — fix that first
3. Messages sent during OPEN state are captured in the DLQ

### Retry Failed Messages

```bash
# Retry a single message
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.businesscommandcentre.com/api/v1/admin/dlq/messages/<id>/retry

# Purge old DLQ entries (7+ days old, auto-expired by Redis TTL)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://api.businesscommandcentre.com/api/v1/admin/dlq/messages/purge
```

### If Provider Credentials Expired

1. Rotate the credential in the provider's dashboard
2. Update the environment variable in Railway
3. Redeploy the API service:
   ```bash
   railway up --service api -p $RAILWAY_PROJECT_ID -e production --detach
   ```

## Post-Incident

- Review DLQ for any messages that need manual retry
- Check message usage metrics: `GET /admin/usage/all`
- Notify affected businesses if messages were delayed significantly
- Update credential rotation calendar to prevent recurrence
