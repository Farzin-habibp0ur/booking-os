# Runbook: Deployment Rollback

## When to Rollback

- Health check fails after deploy (smoke test job fails)
- Spike in Sentry errors after deploy
- Critical user-facing bug discovered post-deploy
- Database migration causes data issues

## Pre-Rollback Checks

1. **Was a database migration included?** Check the commit:
   ```bash
   git log --oneline -1 --name-only | grep migration
   ```
   - If YES: migration rollback may be needed (see below)
   - If NO: safe to rollback code only

2. **Which services were deployed?** Check CI run:
   ```bash
   gh run view <run-id> --log | grep "railway up"
   ```

## Rollback via Railway Dashboard

1. Open Railway: https://railway.app/project/37eeca20-7dfe-45d9-8d29-e902a545f475
2. For each affected service (api, web, admin):
   - Click the service
   - Go to **Deployments** tab
   - Find the last known-good deployment
   - Click **Redeploy**
3. Wait for deployment to complete (2-5 minutes)
4. Verify health:
   ```bash
   curl -s https://api.businesscommandcentre.com/api/v1/health
   curl -s -o /dev/null -w "%{http_code}" https://businesscommandcentre.com
   curl -s -o /dev/null -w "%{http_code}" https://admin.businesscommandcentre.com/api/v1/health
   ```

## Rollback via Git + Railway CLI

1. Identify the last good commit:
   ```bash
   git log --oneline -10
   ```

2. Create a revert commit (do NOT force-push):
   ```bash
   git revert HEAD
   git push origin main
   ```

3. CI will trigger a new deploy automatically. Or deploy manually:
   ```bash
   railway up --service api -p $RAILWAY_PROJECT_ID -e production --detach
   railway up --service web -p $RAILWAY_PROJECT_ID -e production --detach
   railway up --service admin -p $RAILWAY_PROJECT_ID -e production --detach
   ```

## Migration Rollback

Prisma does not support automatic down migrations. If a migration caused issues:

1. **Additive migrations** (new columns, new tables, new indexes): Safe to leave in place. The old code simply won't use the new fields.

2. **Destructive migrations** (dropped columns, renamed fields): Requires manual SQL to undo:
   ```bash
   # Connect to production database
   railway connect postgres
   psql $DATABASE_URL
   # Run corrective SQL manually
   ```

3. **After manual fix**: Mark the migration as rolled back in `_prisma_migrations` table:
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = '20260323000000_problematic_migration';
   ```

## Post-Rollback

- Confirm all three services are healthy
- Check Sentry for new errors
- Notify the team about the rollback and root cause
- Create a post-mortem issue if customer-impacting
