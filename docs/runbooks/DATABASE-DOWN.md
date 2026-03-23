# Runbook: Database Down

## Symptoms

- API returns 500 errors on all data endpoints
- Health check at `GET /api/v1/health` reports database failure
- Sentry alerts with Prisma connection errors (`P1001`, `P1002`)
- BullMQ jobs failing with database connection errors

## Diagnosis

1. Check Railway database status:
   ```bash
   railway status -p $RAILWAY_PROJECT_ID
   ```

2. Verify connectivity from API container:
   ```bash
   railway logs --service api -p $RAILWAY_PROJECT_ID | grep -i "prisma\|database\|postgres"
   ```

3. Check if it's a connection pool exhaustion vs full outage:
   - Pool exhaustion: intermittent 500s, some requests succeed
   - Full outage: all requests fail immediately

## Recovery Steps

### Railway-hosted Postgres

1. Open Railway dashboard: https://railway.app/project/$RAILWAY_PROJECT_ID
2. Navigate to the Postgres service
3. Check the **Metrics** tab for CPU/memory/disk usage
4. If disk is full:
   - Scale up the volume in Railway settings
   - Or connect and run: `VACUUM FULL;` on large tables
5. If the service is crashed:
   - Click **Restart** in Railway dashboard
   - Monitor logs for successful startup
6. If the service won't start:
   - Check Railway status page: https://status.railway.app
   - Escalate via Railway support

### Restore from Backup

If the database is corrupted or data is lost:

1. Get the latest backup artifact from GitHub Actions:
   ```bash
   gh run list --workflow=backup.yml --limit=1
   gh run download <run-id> -n db-backup-<run-id>
   ```

2. Restore:
   ```bash
   DATABASE_URL="postgresql://..." bash scripts/restore-db.sh backups/bookingos-backup-*.dump --dry-run
   # If validation passes:
   DATABASE_URL="postgresql://..." bash scripts/restore-db.sh backups/bookingos-backup-*.dump --force
   ```

3. Run pending migrations:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
   ```

4. Verify data integrity:
   ```bash
   curl https://api.businesscommandcentre.com/api/v1/health
   ```

## Post-Incident

- Check if any BullMQ jobs were lost (inspect DLQ: `GET /admin/dlq/messages`)
- Verify scheduled reminders are still queued
- Notify affected businesses if data loss occurred
