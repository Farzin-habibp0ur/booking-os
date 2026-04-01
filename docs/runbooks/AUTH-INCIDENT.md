# Runbook: Authentication Incident

## Symptoms

- Unauthorized access to accounts
- Reports of session hijacking
- Suspicious login patterns (multiple IPs, unusual times)
- Brute force attempts overwhelming the system
- JWT secret compromise suspected

## Immediate Response

### 1. Confirm the Incident

Check API logs for suspicious patterns:
```bash
railway logs --service api | grep -i "brute\|locked\|unauthorized\|invalid credentials"
```

Check Sentry for spikes in `UnauthorizedException`:
- Filter by tag: `error.type:UnauthorizedException`

### 2. Emergency Token Revocation

**Revoke a specific user's tokens:**

The existing blacklist mechanism handles individual tokens. To force a user to re-authenticate:

1. Change their password (this revokes all stored tokens):
   ```bash
   # Via Prisma — connect to database
   railway connect postgres
   psql $DATABASE_URL
   # Set a temporary password hash (bcrypt of 'ChangeMe123!')
   UPDATE staff SET "passwordHash" = '$2b$12$LJ3m4ys1QKOxKZSB6UzaHOvNpOlQBJP2WMpXQZfVQR5RRvKPKqZSu' WHERE email = 'compromised@example.com';
   ```

2. Notify the user to change their password immediately

**Blacklist all active tokens for a user** (requires API access):
```bash
# Force logout via the admin panel or directly:
# The user's next API call will get 401 and need to re-login
```

### 3. Mass Token Invalidation (JWT Secret Rotation)

If the JWT secret is compromised, ALL tokens must be invalidated:

1. Generate new secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. Update Railway environment variables:
   - `JWT_SECRET` — new value
   - `JWT_REFRESH_SECRET` — new value (must be different from JWT_SECRET)

3. Redeploy ALL services:
   ```bash
   railway up --service api -p $RAILWAY_PROJECT_ID -e production --detach
   railway up --service web -p $RAILWAY_PROJECT_ID -e production --detach
   railway up --service admin -p $RAILWAY_PROJECT_ID -e production --detach
   ```

4. **Impact**: Every user will be logged out and need to re-login. This is expected and necessary.

### 4. Brute Force Attack in Progress

The Redis-backed brute force protection auto-locks accounts after 5 failed attempts for 15 minutes. If an attack is overwhelming:

1. Check Redis for locked accounts:
   ```bash
   railway connect redis
   redis-cli KEYS "auth:brute:*"
   ```

2. If Redis is down and brute force falls back to in-memory, each API instance has independent counters. Consider temporarily reducing `MAX_FAILED_ATTEMPTS` or increasing `LOCKOUT_MINUTES` in code.

3. For targeted attacks on specific accounts, manually extend the lockout:
   ```bash
   redis-cli SET "auth:brute:targeted@email.com" "999" EX 3600
   ```

## Investigation

### Audit Login Activity

Check recent logins in API logs:
```bash
railway logs --service api | grep "login\|Login by unverified"
```

### Check for Compromised Demo Credentials

Verify no production data is accessible via demo credentials:
```bash
curl -s -X POST https://api.businesscommandcentre.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah@glowclinic.com","password":"Bk0s!DemoSecure#2026"}' \
  | jq '.staff.businessId'
```
If this returns a real business ID in production, demo data must be removed.

### Check Token Family for Theft

If refresh token reuse was detected (log: "Token family X revoked due to reuse detection"):
1. The family was already auto-revoked
2. Check which user was affected from the token payload
3. Force a password change for that user

## Post-Incident

- Document the incident timeline
- Review and update rate limits if needed
- Check if 2FA should be enforced for affected accounts
- Review `PlatformAuditLog` for any unauthorized admin actions:
  `GET /admin/audit-logs?action=login`
- Consider enabling mandatory 2FA for all ADMIN/OWNER roles
