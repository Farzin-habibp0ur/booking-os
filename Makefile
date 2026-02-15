COMPOSE = docker compose -f docker-compose.prod.yml

.PHONY: build up down logs migrate seed clean ps

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
