package logger

import (
	"log/slog"
	"time"

	"github.com/go-chi/httplog/v2"
	zlog "github.com/rs/zerolog/log"
)

func NewRouterLogger() *httplog.Logger {
	logger := httplog.NewLogger("httplog-example", httplog.Options{
		JSON:             false,
		LogLevel:         slog.LevelInfo,
		Concise:          true,
		RequestHeaders:   true,
		MessageFieldName: "message",
		Tags: map[string]string{
			"version": "v1.0",
			"env":     "dev",
		},
		QuietDownRoutes: []string{
			"/",
			"/ping",
		},
		QuietDownPeriod: 10 * time.Second,
	})

	return logger
}

func WriteErrCheck(code int, err error) {
	if err != nil {
		zlog.Err(err).Msg("error writing to response writer")
	}
}
