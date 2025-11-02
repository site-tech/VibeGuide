package main

import (
	"fmt"
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
	r.Get("/streams", getStreamsHandler(twitchClient))
	r.Get("/categories", getCategoriesHandler(twitchClient))
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

// getStreamsHandler handles requests to fetch streams from Twitch with flexible query parameters
func getStreamsHandler(twitchClient twitch.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		tId := middleware.GetReqID(ctx)
		apiVersion := ctx.Value(apivctx).(string)

		zlog.Info().Msgf("(%s) getStreamsHandler started", tId)

		// Parse query parameters
		params := twitch.StreamsQueryParams{
			Limit:  twitch.DefaultQueryLimit, // Default value
			GameID: "",                       // Optional
			Sort:   "viewers",                // Default value
		}

		// Parse limit parameter
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err != nil {
				zlog.Error().
					Err(err).
					Str("transaction_id", tId).
					Str("api_version", apiVersion).
					Str("limit_param", limitStr).
					Msg("Invalid limit parameter provided")

				handleErr(w, r, fmt.Errorf("invalid limit parameter: must be a number"), http.StatusBadRequest)
				return
			} else {
				params.Limit = parsedLimit
			}
		}

		// Parse game_id parameter
		if gameID := r.URL.Query().Get("game_id"); gameID != "" {
			params.GameID = gameID
		}

		// Parse sort parameter
		if sort := r.URL.Query().Get("sort"); sort != "" {
			params.Sort = sort
		}

		// Validate parameters
		if err := twitch.ValidateStreamsParams(params); err != nil {
			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Interface("params", params).
				Msg("Invalid parameters provided")

			handleErr(w, r, err, http.StatusBadRequest)
			return
		}

		// Fetch streams from Twitch API
		streamsResponse, err := twitchClient.GetStreams(ctx, params)
		if err != nil {
			// Determine appropriate HTTP status code based on error type
			statusCode := determineErrorStatusCode(err)

			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Int("status_code", statusCode).
				Interface("params", params).
				Msg("Failed to fetch streams from Twitch API")

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
			Interface("params", params).
			Msg("getStreamsHandler completed successfully")
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

// getCategoriesHandler handles requests to fetch game categories from Twitch
func getCategoriesHandler(twitchClient twitch.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		tId := middleware.GetReqID(ctx)
		apiVersion := ctx.Value(apivctx).(string)

		zlog.Info().Msgf("(%s) getCategoriesHandler started", tId)

		// Parse limit parameter from query string (optional)
		limit := twitch.DefaultCategoryLimit
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
				if parsedLimit > twitch.MaxCategoryLimit {
					parsedLimit = twitch.MaxCategoryLimit
				}
				limit = parsedLimit
			}
		}

		// Parse sort parameter from query string (optional)
		sortBy := r.URL.Query().Get("sort")
		if sortBy == "" {
			sortBy = "top" // Default to top categories
		}

		// Validate sort parameter
		if sortBy != "top" {
			zlog.Error().
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Str("sort_param", sortBy).
				Msg("Invalid sort parameter provided")

			handleErr(w, r, fmt.Errorf("invalid sort parameter: %s, only 'top' is supported", sortBy), http.StatusBadRequest)
			return
		}

		// Fetch categories from Twitch API
		categoriesResponse, err := twitchClient.GetCategories(ctx, limit, sortBy)
		if err != nil {
			// Determine appropriate HTTP status code based on error type
			statusCode := determineErrorStatusCode(err)

			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Int("status_code", statusCode).
				Int("requested_limit", limit).
				Str("sort_by", sortBy).
				Msg("Failed to fetch categories from Twitch API")

			handleErr(w, r, err, statusCode)
			return
		}

		// Build successful response
		resp := mytypes.APIHandlerResp{
			TransactionId: tId,
			ApiVersion:    apiVersion,
			Data:          categoriesResponse,
		}

		w.WriteHeader(http.StatusOK)
		render.JSON(w, r, resp)

		zlog.Info().
			Str("transaction_id", tId).
			Str("api_version", apiVersion).
			Int("category_count", len(categoriesResponse.Data)).
			Str("sort_by", sortBy).
			Msg("getCategoriesHandler completed successfully")
	}
}
