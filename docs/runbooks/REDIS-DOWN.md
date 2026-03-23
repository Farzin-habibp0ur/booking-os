# Runbook: Redis Down

## Symptoms

- BullMQ queues stalled (no AI processing, no reminders, no message dispatch)
- WebSocket connections dropping or not delivering real-time updates
- Brute force protection falling back to in-memory (logs: "Redis error, falling back to memory")
- Circuit breaker state not persisting across restarts
- JWT blacklist entries lost (revoked tokens temporarily accepted)

## Impact Assessment

| System | Impact | Fallback |
|---|---|---|
| BullMQ (8 queues) | All background jobs stall | None — jobs queue up and process when Redis returns |
| WebSocket (Socket.IO) | Adapter loses cross-instance pub/sub | Single-instance still works |
| Brute force | Falls back to in-memory Map | Works per-instance only |
| JWT blacklist | Falls back to in-memory Map | Tokens blacklisted before outage may be accepted |
| Circuit breaker | Falls back to in-memory | State resets, may re-open circuits |
| DLQ | Cannot read/write failed messages | Messages lost until Redis returns |

## Diagnosis

1. Check Redis connectivity:
   ```bash
   railway logs --service redis -p $RAILWAY_PROJECT_ID
   ```

2. Check API logs for Redis errors:
   ```bash
   railway logs --service api -p $RAILWAY_PROJECT_ID | grep -i redis
   ```

3. Check memory usage — Redis may be OOM:
   ```bash
   # Connect via Railway CLI
   railway connect redis
   redis-cli INFO memory
   ```

## Recovery Steps

### Railway-hosted Redis

1. Open Railway dashboard, navigate to Redis service
2. Check **Metrics** for memory usage
3. If OOM:
   - Check for large keys: `redis-cli --bigkeys`
   - Flush expired DLQ entries: `redis-cli KEYS "dlq:msg:*" | head -100`
   - Scale up Redis memory in Railway
4. If crashed:
   - Click **Restart** in Railway dashboard
   - Monitor: `railway logs --service redis`
5. After Redis recovers:
   - BullMQ jobs will auto-resume processing
   - Circuit breaker states reset to CLOSED (safe default)
   - Verify queues: check Sentry for any new job failures

### If Redis Won't Recover

1. The API continues serving requests with degraded functionality
2. Background jobs will not process — inform affected businesses about delays
3. Provision a new Redis instance in Railway
4. Update `REDIS_URL` environment variable on the API service
5. Redeploy API: `railway up --service api -p $RAILWAY_PROJECT_ID -e production --detach`

## Post-Incident

- Check DLQ for any failed messages: `GET /admin/dlq/messages`
- Retry failed messages: `POST /admin/dlq/messages/:id/retry`
- Verify circuit breakers are all CLOSED: check admin messaging dashboard
- Confirm BullMQ queues are draining (no backlog)
