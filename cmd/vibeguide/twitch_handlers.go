package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/site-tech/VibeGuide/pkg/mytypes"
	"github.com/site-tech/VibeGuide/pkg/twitch"

	zlog "github.com/rs/zerolog/log"
)

// FollowsCacheEntry represents a cached follows response with expiration
type FollowsCacheEntry struct {
	Data      *twitch.FollowsResponse
	CachedAt  time.Time
	ExpiresAt time.Time
}

// FollowsCache provides thread-safe caching for user follows data
type FollowsCache struct {
	mu    sync.RWMutex
	cache map[string]*FollowsCacheEntry
}

// NewFollowsCache creates a new follows cache instance
func NewFollowsCache() *FollowsCache {
	return &FollowsCache{
		cache: make(map[string]*FollowsCacheEntry),
	}
}

// Get retrieves cached follows data for a user if not expired
func (fc *FollowsCache) Get(userID string) (*twitch.FollowsResponse, bool) {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	entry, exists := fc.cache[userID]
	if !exists {
		return nil, false
	}

	// Check if cache entry has expired
	if time.Now().After(entry.ExpiresAt) {
		return nil, false
	}

	return entry.Data, true
}

// Set stores follows data in cache with 5-minute expiration
func (fc *FollowsCache) Set(userID string, data *twitch.FollowsResponse) {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	now := time.Now()
	fc.cache[userID] = &FollowsCacheEntry{
		Data:      data,
		CachedAt:  now,
		ExpiresAt: now.Add(5 * time.Minute),
	}
}

// Clear removes expired entries from cache
func (fc *FollowsCache) Clear() {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	now := time.Now()
	for userID, entry := range fc.cache {
		if now.After(entry.ExpiresAt) {
			delete(fc.cache, userID)
		}
	}
}

// Global follows cache instance
var followsCache = NewFollowsCache()

// getMetadataKeys returns the keys from user metadata for debugging
func getMetadataKeys(metadata map[string]interface{}) []string {
	if metadata == nil {
		return []string{"<nil metadata>"}
	}
	keys := make([]string, 0, len(metadata))
	for key := range metadata {
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		return []string{"<empty metadata>"}
	}
	return keys
}

// cleanupFollowsCache removes expired entries from the global follows cache
func cleanupFollowsCache() {
	followsCache.Clear()
}

// twitchRouter creates a router for Twitch-related endpoints
func twitchRouter(twitchClient twitch.Client) http.Handler {
	fmt.Printf("0======================")
	r := chi.NewRouter()
	r.Get("/streams/top", getTopStreamsHandler(twitchClient))
	r.Get("/streams", getStreamsHandler(twitchClient))
	r.Get("/categories", getCategoriesHandler(twitchClient))
	r.Get("/follows", getFollowsHandler(twitchClient))
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

// getFollowsHandler handles requests to fetch user follows from Twitch
func getFollowsHandler(twitchClient twitch.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		tId := middleware.GetReqID(ctx)
		apiVersion := ctx.Value(apivctx).(string)

		zlog.Info().Msgf("🚀🚀🚀 FOLLOWS HANDLER STARTED - Transaction ID: %s 🚀🚀🚀", tId)
		zlog.Info().Msgf("📋 API Version: %s", apiVersion)
		zlog.Info().Msgf("🔍 Request Method: %s, URL: %s", r.Method, r.URL.String())
		zlog.Info().Msgf("🔑 Authorization Header Present: %t", r.Header.Get("Authorization") != "")

		// Extract and validate Supabase JWT token
		supabaseToken, err := extractBearerToken(r)

		fmt.Printf("1======================================: %v\n", supabaseToken)
		if err != nil {
			zlog.Error().Msgf("❌❌❌ FAILED TO EXTRACT BEARER TOKEN - Transaction ID: %s - Error: %v ❌❌❌", tId, err)
			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Msg("Failed to extract Supabase JWT token")

			handleErr(w, r, fmt.Errorf("authentication required"), http.StatusUnauthorized)
			return
		}

		zlog.Info().Msgf("✅ Successfully extracted Supabase JWT token - Transaction ID: %s", tId)

		// Check for Twitch provider token in headers (fallback approach)
		twitchProviderToken := r.Header.Get("X-Twitch-Token")
		zlog.Info().Msgf("🎮 Twitch provider token in headers: %t - Transaction ID: %s", twitchProviderToken != "", tId)

		// Get user information from Supabase token
		zlog.Info().Msgf("🔐 Attempting to validate Supabase JWT with auth client - Transaction ID: %s", tId)
		authClient := SBClient.Auth.WithToken(supabaseToken)
		user, err := authClient.GetUser()

		if err != nil {
			zlog.Error().Msgf("❌❌❌ FAILED TO VALIDATE SUPABASE JWT - Transaction ID: %s - Error: %v ❌❌❌", tId, err)
			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Msg("Failed to validate Supabase JWT token")

			handleErr(w, r, fmt.Errorf("invalid authentication token"), http.StatusUnauthorized)
			return
		}

		zlog.Info().Msgf("✅ Successfully validated Supabase JWT - User ID: %s - Transaction ID: %s", user.ID.String(), tId)

		// Extract Twitch token - try metadata first, then fallback to header
		var twitchToken string
		var twitchTokenSource string

		zlog.Info().Msgf("🎮 Attempting to extract Twitch token from user metadata - User ID: %s - Transaction ID: %s", user.ID.String(), tId)
		zlog.Info().Msgf("📊 User metadata keys: %+v", getMetadataKeys(user.User.UserMetadata))

		metadataToken, err := extractTwitchTokenFromUser(&user.User)
		if err == nil && metadataToken != "" {
			twitchToken = metadataToken
			twitchTokenSource = "metadata"
			zlog.Info().Msgf("✅ Successfully extracted Twitch token from metadata - User ID: %s - Transaction ID: %s", user.ID.String(), tId)
		} else {
			zlog.Warn().Msgf("⚠️ Failed to extract Twitch token from metadata - User ID: %s - Transaction ID: %s - Error: %v", user.ID.String(), tId, err)
			zlog.Warn().Msgf("📊 Full user metadata: %+v", user.User.UserMetadata)

			// Fallback to header token
			if twitchProviderToken != "" {
				twitchToken = twitchProviderToken
				twitchTokenSource = "header"
				zlog.Info().Msgf("✅ Using Twitch token from header as fallback - User ID: %s - Transaction ID: %s", user.ID.String(), tId)
			} else {
				zlog.Error().Msgf("❌❌❌ NO TWITCH TOKEN AVAILABLE - User ID: %s - Transaction ID: %s ❌❌❌", user.ID.String(), tId)
				handleErr(w, r, fmt.Errorf("twitch authentication required - no token in metadata or headers"), http.StatusForbidden)
				return
			}
		}

		zlog.Info().Msgf("🔑 Using Twitch token from: %s - User ID: %s - Transaction ID: %s", twitchTokenSource, user.ID.String(), tId)

		// Extract Twitch user ID - try metadata first, then fallback to API call
		var twitchUserID string
		var userIDSource string

		zlog.Info().Msgf("🆔 Attempting to extract Twitch user ID from user metadata - User ID: %s - Transaction ID: %s", user.ID.String(), tId)
		metadataUserID, err := extractTwitchUserIDFromUser(&user.User)
		if err == nil && metadataUserID != "" {
			twitchUserID = metadataUserID
			userIDSource = "metadata"
			zlog.Info().Msgf("✅ Successfully extracted Twitch user ID from metadata: %s - Supabase User ID: %s - Transaction ID: %s", twitchUserID, user.ID.String(), tId)
		} else {
			zlog.Warn().Msgf("⚠️ Failed to extract Twitch user ID from metadata - User ID: %s - Transaction ID: %s - Error: %v", user.ID.String(), tId, err)
			zlog.Warn().Msgf("📊 Full user metadata for ID extraction: %+v", user.User.UserMetadata)

			// Fallback: Get user ID from Twitch API using the token
			zlog.Info().Msgf("🌐 Fetching Twitch user ID from API as fallback - Transaction ID: %s", tId)
			twitchUser, err := twitchClient.GetUserInfo(ctx, twitchToken)
			if err != nil {
				zlog.Error().Msgf("❌❌❌ FAILED TO GET TWITCH USER ID FROM API - Transaction ID: %s - Error: %v ❌❌❌", tId, err)
				handleErr(w, r, fmt.Errorf("failed to get twitch user information: %v", err), http.StatusForbidden)
				return
			}
			twitchUserID = twitchUser.ID
			userIDSource = "api"
			zlog.Info().Msgf("✅ Successfully fetched Twitch user ID from API: %s (login: %s) - Transaction ID: %s", twitchUserID, twitchUser.Login, tId)
		}

		zlog.Info().Msgf("🔑 Using Twitch user ID from: %s - ID: %s - Transaction ID: %s", userIDSource, twitchUserID, tId)

		// Check cache first
		zlog.Info().Msgf("💾 Checking cache for Twitch user ID: %s - Transaction ID: %s", twitchUserID, tId)
		if cachedFollows, found := followsCache.Get(twitchUserID); found {
			zlog.Info().Msgf("🎯🎯🎯 CACHE HIT! Returning cached follows data - Twitch User ID: %s - Transaction ID: %s 🎯🎯🎯", twitchUserID, tId)
			zlog.Debug().
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Str("twitch_user_id", twitchUserID).
				Msg("Returning cached follows data")

			// Build successful response with cached data
			resp := mytypes.APIHandlerResp{
				TransactionId: tId,
				ApiVersion:    apiVersion,
				Data: map[string]interface{}{
					"follows":   cachedFollows.Data,
					"total":     cachedFollows.Total,
					"cached_at": time.Now().Format(time.RFC3339),
				},
			}

			w.WriteHeader(http.StatusOK)
			render.JSON(w, r, resp)
			return
		}

		zlog.Info().Msgf("💾 Cache miss - will fetch fresh data from Twitch API - Twitch User ID: %s - Transaction ID: %s", twitchUserID, tId)

		// Fetch follows from Twitch API
		zlog.Info().Msgf("🌐 Making API call to Twitch to fetch follows - Twitch User ID: %s - Transaction ID: %s", twitchUserID, tId)
		followsResponse, err := twitchClient.GetUserFollows(ctx, twitchUserID, twitchToken)
		if err != nil {
			// Determine appropriate HTTP status code based on error type
			statusCode := determineErrorStatusCode(err)

			zlog.Error().Msgf("❌❌❌ TWITCH API CALL FAILED - Twitch User ID: %s - Transaction ID: %s - Error: %v ❌❌❌", twitchUserID, tId, err)
			zlog.Error().
				Err(err).
				Str("transaction_id", tId).
				Str("api_version", apiVersion).
				Int("status_code", statusCode).
				Str("twitch_user_id", twitchUserID).
				Msg("Failed to fetch follows from Twitch API")

			handleErr(w, r, err, statusCode)
			return
		}

		zlog.Info().Msgf("✅ Successfully fetched follows from Twitch API - Count: %d - Twitch User ID: %s - Transaction ID: %s", len(followsResponse.Data), twitchUserID, tId)

		// Cache the response
		zlog.Info().Msgf("💾 Caching follows response - Twitch User ID: %s - Transaction ID: %s", twitchUserID, tId)
		followsCache.Set(twitchUserID, followsResponse)

		// Build successful response
		resp := mytypes.APIHandlerResp{
			TransactionId: tId,
			ApiVersion:    apiVersion,
			Data: map[string]interface{}{
				"follows":   followsResponse.Data,
				"total":     followsResponse.Total,
				"cached_at": time.Now().Format(time.RFC3339),
			},
		}

		w.WriteHeader(http.StatusOK)
		render.JSON(w, r, resp)

		zlog.Info().Msgf("🎉🎉🎉 FOLLOWS HANDLER COMPLETED SUCCESSFULLY - Follows: %d - Total: %d - Twitch User ID: %s - Transaction ID: %s 🎉🎉🎉", len(followsResponse.Data), followsResponse.Total, twitchUserID, tId)
		zlog.Info().
			Str("transaction_id", tId).
			Str("api_version", apiVersion).
			Int("follows_count", len(followsResponse.Data)).
			Int("total_follows", followsResponse.Total).
			Str("twitch_user_id", twitchUserID).
			Msg("getFollowsHandler completed successfully")
	}
}
