# ====================
# Docker Compose Commands
# ====================
.PHONY: up down logs
up: ## Start up all services in the background
	@echo "Starting up all services..."
	@docker compose up --build

upd: ## Start up all services in the background
	@echo "Starting up all services..."
	@docker compose up -d --build

down: ## Stop and remove all services
	@echo "Stopping and removing all services..."
	@docker compose down

logs: ## Follow logs of all services
	@echo "Following logs of all services..."
	@docker compose logs -f

# ====================
# Makefile Variables
# ====================
SERVICE ?= vibeguide
ifeq ($(SERVICE),vibeguide)
    SERVICE_PATH := cmd/vibeguide
    DOCKERFILE := $(SERVICE_PATH)/vibe.Dockerfile
		DOCKER_HUB := vibeguide
    ENV_FILE := $(SERVICE_PATH)/vibe.env
    # HELM_CHART := helm/$(SERVICE)
    REGISTRY_USER := molson82
    IMAGE_NAME := $(REGISTRY_USER)/$(DOCKER_HUB)
    VERSION := 0.1.0
    SERVICE_PORT := 8080
else
    $(error Invalid SERVICE. Please set SERVICE to 'togo' or 'image')
endif

# ====================
# Help Command
# ====================
.PHONY: help
help: ## Show this help message
	@echo "=========================================================================================="
	@echo "                     Makefile Help: Building and Managing Services                        "
	@echo "=========================================================================================="
	@echo "Usage: make <command> [SERVICE=<service_name>]"
	@echo ""
	@echo "Available Services: togo (port 8080), image (port 8081) (default: togo)"
	@echo ""
	@echo "Docker Compose Commands:"
	@echo "  up                    Start up all services."
	@echo "  upd                   Start up all services in the background."
	@echo "  down                  Stop and remove all services."
	@echo "  logs                  Follow logs of all services."
	@echo ""
	@echo "General Commands:"
	@echo "  help                  Display this help message."
	@echo "  l, docker-login       Login to Docker registry."
	@echo "  b, build              Build a local Docker image for the specified service."
	@echo "  pl, docker-push-local Push the local dev Docker image to the registry."
	@echo "  c, docker-clean       Clean up stopped Docker containers and unused images."
	@echo "  cb                    Clean and then build the service."
	@echo ""
	@echo "Local Run Commands:"
	@echo "  rl, run-api-local     Run the local Docker image for the service with the service's env file."
	@echo "  brl                   Build and then run the service locally."
	@echo "  cbrl                  Clean, build, and then run the service locally."
	@echo "  rm, run-api-main      Pull the latest main image from the registry and run it."
	@echo ""
	@echo "Golang Commands:"
	@echo "  gci, lint             Run golangci-lint on the service's code."
	@echo "  fgci, fix-lint        Run golangci-lint and fix issues."
	@echo ""
	@echo "Swaggo Commands:"
	@echo "  tswag, swaggo         Generate Swagger API documentation for the service."
	@echo ""

# ====================
# General Commands
# ====================
.PHONY: docker-login
docker-login: ## Login to Docker registry
	@echo "Logging into Docker..."
	@docker login

.PHONY: build
build: ## Build a local Docker image
	@echo "Building $(SERVICE) REST-API"
	@docker build -t $(SERVICE):local -f $(DOCKERFILE) .
	@echo "Done building $(SERVICE)"

.PHONY: docker-push-local
docker-push-local: ## Push the local dev Docker image
	@echo "Pushing local docker image for $(SERVICE)"
	@docker tag $(SERVICE):local $(IMAGE_NAME):localdev
	@docker push $(IMAGE_NAME):localdev

.PHONY: docker-clean
docker-clean: ## Clean up stopped Docker containers and unused images
	@echo "Cleaning up Docker resources..."
	@docker container prune -f
	@docker image prune -a -f
	@echo "Done cleaning up Docker resources."

# ====================
# Local Run Commands
# ====================
.PHONY: run-api-local
run-api-local: ## Run the local Docker image
	@echo "Running $(SERVICE) REST-API Docker Image on port $(SERVICE_PORT)"
	@docker run --env-file $(ENV_FILE) -p $(SERVICE_PORT):$(SERVICE_PORT) $(SERVICE):local /app/$(SERVICE)

.PHONY: run-api-main
run-api-main: ## Run the latest main image from the registry
	@echo "Pulling latest main image: $(IMAGE_NAME):main"
	@docker pull $(IMAGE_NAME):main
	@echo "Running $(SERVICE) REST-API Docker Image on port $(SERVICE_PORT)"
	@docker run -p $(SERVICE_PORT):$(SERVICE_PORT) --platform linux/amd64 $(IMAGE_NAME):main

# ====================
# Golang Commands
# ====================
.PHONY: lint
lint: ## Run golangci-lint
	@echo "Running golangci-lint for $(SERVICE)"
	@golangci-lint run $(SERVICE_PATH)/...

.PHONY: fix-lint
fix-lint: ## Fix golangci-lint issues
	@echo "Fixing golangci-lint issues for $(SERVICE)"
	@golangci-lint run $(SERVICE_PATH)/... --fix

# ====================
# Swaggo Commands
# ====================
.PHONY: swaggo
swaggo: ## Generate Swagger API documentation
	@echo "Generating Swagger documentation for $(SERVICE)"
	@swag init -d $(SERVICE_PATH) --output $(SERVICE_PATH)/docs

# ====================
# Combined Shortcuts
# ====================
.PHONY: cb brl cbrl
cb: docker-clean build ## Clean and build
brl: build run-api-local ## Build and run locally
cbrl: docker-clean build run-api-local ## Clean, build, and run locally

# ====================
# Shorthand Commands
# ====================
l: docker-login
b: build
pl: docker-push-local
c: docker-clean
rl: run-api-local
rm: run-api-main
gci: lint
fgci: fix-lint
tswag: swaggo
