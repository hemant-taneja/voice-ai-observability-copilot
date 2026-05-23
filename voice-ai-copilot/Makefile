.PHONY: infra infra-down migrate seed dev dev-backend dev-frontend test test-backend test-frontend lint ngrok

# Start infrastructure (postgres, redis, temporal)
infra:
	docker compose up -d

# Stop infrastructure
infra-down:
	docker compose down

# Run database migrations
migrate:
	cd backend && npm run migrate

# Seed demo data
seed: ## Insert sample data
	cd backend && npx ts-node src/scripts/seed.ts

# Start both backend and frontend in dev mode
dev:
	npm run dev

# Start only backend
dev-backend:
	cd backend && npm run dev

# Start only frontend
dev-frontend:
	cd frontend && npm run dev

# Run all tests
test:
	cd backend && npm test
	cd frontend && npm test

# Run backend tests only
test-backend:
	cd backend && npm test

# Run frontend tests only
test-frontend:
	cd frontend && npm test

# Expose local server via ngrok for GHL webhook testing
ngrok:
	ngrok http 3000
