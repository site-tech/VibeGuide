package main

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/site-tech/VibeGuide/pkg/mytypes"
	"github.com/site-tech/VibeGuide/pkg/twitch"

	zlog "github.com/rs/zerolog/log"
)

// twitchRouter creates a router for Twitch-related endpoints
func twitchRouter(twitchClient twitch.Client) http.Handler {
	r := chi.NewRouter()
	r.Get("/streams/top", getTopStreamsHandler(twitchClient))
	return r
}

// getTopStreamsHandler handles requests to fetch top streams from Twitch
func getTopStreamsHandler(twitchClient twitch.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		tId := middleware.GetReqID(ctx)
		apiVersion := ctx.Value(apivctx).(string)

		zlog.Info().Msgf("(%s) getTopStreamsHandler started", tId)

		// Parse count parameter from query string (optional)
		count := twitch.DefaultStreamLimit
		if countStr := r.URL.Query().Get("count"); countStr != "" {
			if parsedCount, err := strconv.Atoi(countStr); err == nil && parsedCount > 0 {
				count = parsedCount
			}
		}

		// Fetch top streams from Twitch API
		streamsResponse, err := twitchClient.GetTopStreams(ctx, count)
		if err != nil {
			// Determine appropriate HTTP status code based on error type
			statusCode := determineErrorStatusCode(err)

			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Int("status_code", statusCode).
				Int("requested_count", count).
				Msg("Failed to fetch top streams from Twitch API")

			handleErr(w, r, err, statusCode)
			return
		}

		// Build successful response
		resp := mytypes.APIHandlerResp{
			TransactionId: tId,
			ApiVersion:    apiVersion,
			Data:          streamsResponse,
		}

		w.WriteHeader(http.StatusOK)
		render.JSON(w, r, resp)

		zlog.Info().
			Str("transaction_id", tId).
			Str("api_version", apiVersion).
			Int("stream_count", len(streamsResponse.Data)).
			Msg("getTopStreamsHandler completed successfully")
	}
}

// determineErrorStatusCode maps error types to appropriate HTTP status codes
func determineErrorStatusCode(err error) int {
	errMsg := strings.ToLower(err.Error())

	// OAuth/Authentication errors
	if strings.Contains(errMsg, "oauth") || strings.Contains(errMsg, "token") || strings.Contains(errMsg, "unauthorized") {
		return http.StatusServiceUnavailable // 503 - Service temporarily unavailable due to auth issues
	}

	// Rate limiting errors
	if strings.Contains(errMsg, "rate limit") || strings.Contains(errMsg, "too many requests") {
		return http.StatusTooManyRequests // 429
	}

	// Twitch API specific errors
	if strings.Contains(errMsg, "twitch api returned error status") {
		// Extract status code from error message if possible
		if strings.Contains(errMsg, "status 400") {
			return http.StatusBadRequest // 400 - Bad request to Twitch API
		}
		if strings.Contains(errMsg, "status 401") {
			return http.StatusServiceUnavailable // 503 - Auth issue with Twitch
		}
		if strings.Contains(errMsg, "status 403") {
			return http.StatusServiceUnavailable // 503 - Forbidden by Twitch
		}
		if strings.Contains(errMsg, "status 404") {
			return http.StatusNotFound // 404 - Resource not found
		}
		if strings.Contains(errMsg, "status 429") {
			return http.StatusTooManyRequests // 429 - Rate limited by Twitch
		}
		if strings.Contains(errMsg, "status 5") {
			return http.StatusBadGateway // 502 - Twitch server error
		}
	}

	// Network/connectivity errors
	if strings.Contains(errMsg, "connection") || strings.Contains(errMsg, "timeout") || strings.Contains(errMsg, "network") {
		return http.StatusBadGateway // 502 - Bad gateway (upstream issue)
	}

	// JSON parsing errors
	if strings.Contains(errMsg, "json") || strings.Contains(errMsg, "parse") {
		return http.StatusBadGateway // 502 - Bad response from upstream
	}

	// Default to service unavailable for unknown errors
	return http.StatusServiceUnavailable // 503
}
