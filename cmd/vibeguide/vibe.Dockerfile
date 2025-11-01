FROM golang:1.25.3-alpine3.22 AS builder

RUN apk add --no-cache build-base libheif-dev

WORKDIR /app
COPY . .
RUN go build -o bin/vibeguide -v ./cmd/vibeguide

# --- Final image ---
FROM alpine:3.22

WORKDIR /app
COPY --from=builder /app/bin/vibeguide .
EXPOSE 8081
