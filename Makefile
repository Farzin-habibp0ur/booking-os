COMPOSE = docker compose -f docker-compose.prod.yml

.PHONY: build up down logs migrate seed clean ps deploy backup restore ssl-init ssl-renew monitor

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

migrate:
	$(COMPOSE) exec api npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

seed:
	$(COMPOSE) exec api npx prisma db seed --schema=packages/db/prisma/schema.prisma

clean:
	$(COMPOSE) down -v --rmi local

deploy:
	git pull origin main
	$(COMPOSE) build
	$(COMPOSE) up -d

backup:
	bash scripts/backup-db.sh

restore:
	bash scripts/restore-db.sh $(FILE)

ssl-init:
	bash scripts/init-ssl.sh

ssl-renew:
	bash scripts/renew-ssl.sh

monitor:
	bash scripts/monitor.sh
