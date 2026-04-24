.PHONY: dev backend frontend install lint test

dev: ## Run backend + frontend concurrently (requires tmux or two terminals)
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

backend: ## Start FastAPI dev server
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Start Vite dev server
	cd frontend && npm run dev

install: ## Install all dependencies
	cd backend && pip install -e ".[dev]"
	cd frontend && npm install

lint: ## Lint both layers
	cd backend && ruff check . && mypy app
	cd frontend && npm run lint

test: ## Run all tests
	cd backend && pytest
	cd frontend && npm run test
