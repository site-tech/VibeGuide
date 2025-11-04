package twitch

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// NewClient creates a new Twitch client instance
func NewClient(clientID, clientSecret string) Client {
	httpClient := &http.Client{
		Timeout: HTTPTimeout * time.Second,
	}

	oauthManager := NewOAuthManager(clientID, clientSecret)

	return &ClientImpl{
		clientID:     clientID,
		clientSecret: clientSecret,
		oauthManager: oauthManager,
		httpClient:   httpClient,
	}
}

// GetTopStreams fetches top streams from Twitch API
func (c *ClientImpl) GetTopStreams(ctx context.Context, limit int) (*StreamsResponse, error) {
	// Validate limit parameter
	if limit <= 0 {
		limit = DefaultStreamLimit
	}
	if limit > MaxStreamLimit {
		limit = MaxStreamLimit
	}

	// Get OAuth token
	token, err := c.oauthManager.GetToken(ctx)
	if err != nil {
		log.Error().Err(err).Int("limit", limit).Msg("Failed to get OAuth token for GetTopStreams")
		return nil, fmt.Errorf("failed to get OAuth token: %w", err)
	}

	// Build request URL
	url := fmt.Sprintf("%s%s?first=%d", TwitchAPIBaseURL, StreamsEndpoint, limit)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set required headers
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Client-Id", c.clientID)
	req.Header.Set("Content-Type", "application/json")

	// Make the request
	log.Debug().Str("url", url).Int("limit", limit).Msg("Making request to Twitch API")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Str("url", url).Msg("Failed to make request to Twitch API")
		return nil, fmt.Errorf("failed to make request to Twitch API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Handle HTTP error status codes
	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Str("url", url).
			Msg("Twitch API returned error status")
		return nil, fmt.Errorf("Twitch API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse JSON response
	var streamsResponse StreamsResponse
	if err := json.Unmarshal(body, &streamsResponse); err != nil {
		log.Error().
			Err(err).
			Str("response_body", string(body)).
			Msg("Failed to parse JSON response from Twitch API")
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	log.Debug().
		Int("stream_count", len(streamsResponse.Data)).
		Int("requested_limit", limit).
		Msg("Successfully fetched streams from Twitch API")

	return &streamsResponse, nil
}

// GetStreams fetches streams from Twitch API with flexible query parameters
// TODO: instead of having this on the implementation, let's make a class and have the implementation injected
func (c *ClientImpl) GetStreams(ctx context.Context, params StreamsQueryParams) (*StreamsResponse, error) {
	// Validate parameters
	if err := ValidateStreamsParams(params); err != nil {
		log.Error().Err(err).Interface("params", params).Msg("Invalid parameters for GetStreams")
		return nil, fmt.Errorf("invalid parameters: %w", err)
	}

	// Set default values
	if params.Limit <= 0 {
		params.Limit = DefaultQueryLimit
	}
	if params.Sort == "" {
		params.Sort = "viewers"
	}

	// Get OAuth token
	// TODO: move this check to the beginning
	token, err := c.oauthManager.GetToken(ctx)
	if err != nil {
		log.Error().Err(err).Interface("params", params).Msg("Failed to get OAuth token for GetStreams")
		return nil, fmt.Errorf("failed to get OAuth token: %w", err)
	}

	// Build request URL with query parameters
	url := c.buildStreamsURL(params)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set required headers
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Client-Id", c.clientID)
	req.Header.Set("Content-Type", "application/json")

	// Make the request
	log.Debug().Str("url", url).Interface("params", params).Msg("Making request to Twitch API")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Str("url", url).Msg("Failed to make request to Twitch API")
		return nil, fmt.Errorf("failed to make request to Twitch API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Handle HTTP error status codes
	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Str("url", url).
			Msg("Twitch API returned error status")
		return nil, fmt.Errorf("twitch API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse JSON response
	var streamsResponse StreamsResponse
	if err := json.Unmarshal(body, &streamsResponse); err != nil {
		log.Error().
			Err(err).
			Str("response_body", string(body)).
			Msg("Failed to parse JSON response from Twitch API")
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	// Apply client-side sorting for "recent" option
	if params.Sort == "recent" {
		c.sortStreamsByRecent(streamsResponse.Data)
	}

	log.Debug().
		Int("stream_count", len(streamsResponse.Data)).
		Interface("params", params).
		Msg("Successfully fetched streams from Twitch API")

	return &streamsResponse, nil
}

// GetAuthorizationURL generates the Twitch OAuth authorization URL
func (c *ClientImpl) GetAuthorizationURL(redirectURI, state string, scopes []string) string {
	params := url.Values{}
	params.Set("client_id", c.clientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("state", state)

	if len(scopes) > 0 {
		params.Set("scope", strings.Join(scopes, " "))
	}

	return fmt.Sprintf("%s?%s", TwitchOAuthAuthorize, params.Encode())
}

// ExchangeCodeForToken exchanges an authorization code for an access token
func (c *ClientImpl) ExchangeCodeForToken(ctx context.Context, code, redirectURI string) (*UserToken, error) {
	fmt.Println("1------------------------------------------")

	data := url.Values{}
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, "POST", TwitchOAuthURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to exchange code for token")
		return nil, fmt.Errorf("token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Msg("Token exchange failed")
		return nil, fmt.Errorf("token exchange failed with status %d: %s", resp.StatusCode, string(body))
	}

	var token UserToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	log.Info().Msg("Successfully exchanged code for user token")
	return &token, nil
}

// ValidateToken validates an access token and returns user information
func (c *ClientImpl) ValidateToken(ctx context.Context, accessToken string) (*TokenValidation, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", TwitchOAuthValidate, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create validation request: %w", err)
	}

	req.Header.Set("Authorization", "OAuth "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to validate token")
		return nil, fmt.Errorf("token validation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Msg("Token validation failed")
		return nil, fmt.Errorf("token validation failed with status %d: %s", resp.StatusCode, string(body))
	}

	var validation TokenValidation
	if err := json.NewDecoder(resp.Body).Decode(&validation); err != nil {
		return nil, fmt.Errorf("failed to parse validation response: %w", err)
	}

	log.Debug().Str("user_id", validation.UserID).Str("login", validation.Login).Msg("Token validated successfully")
	return &validation, nil
}

// GetUserInfo fetches user information using an access token
func (c *ClientImpl) GetUserInfo(ctx context.Context, accessToken string) (*User, error) {
	url := fmt.Sprintf("%s%s", TwitchAPIBaseURL, UsersEndpoint)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Client-Id", c.clientID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get user info")
		return nil, fmt.Errorf("user info request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read user info response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Msg("Get user info failed")
		return nil, fmt.Errorf("get user info failed with status %d: %s", resp.StatusCode, string(body))
	}

	var usersResponse UsersResponse
	if err := json.Unmarshal(body, &usersResponse); err != nil {
		return nil, fmt.Errorf("failed to parse user info response: %w", err)
	}

	if len(usersResponse.Data) == 0 {
		return nil, fmt.Errorf("no user data returned")
	}

	log.Info().Str("user_id", usersResponse.Data[0].ID).Str("login", usersResponse.Data[0].Login).Msg("Successfully fetched user info")
	return &usersResponse.Data[0], nil
}

// GetCategories fetches game categories from Twitch API with sort parameter
func (c *ClientImpl) GetCategories(ctx context.Context, limit int, sortBy string) (*CategoriesResponse, error) {
	// Validate limit parameter
	if limit <= 0 {
		limit = DefaultCategoryLimit
	}
	if limit > MaxCategoryLimit {
		limit = MaxCategoryLimit
	}

	// Validate sortBy parameter - only "top" is supported for now
	if sortBy != "" && sortBy != "top" {
		return nil, fmt.Errorf("invalid sort parameter: %s, only 'top' is supported", sortBy)
	}

	// Get OAuth token
	token, err := c.oauthManager.GetToken(ctx)
	if err != nil {
		log.Error().Err(err).Int("limit", limit).Str("sort", sortBy).Msg("Failed to get OAuth token for GetCategories")
		return nil, fmt.Errorf("failed to get OAuth token: %w", err)
	}

	// Build request URL - using /games/top endpoint for top categories
	url := fmt.Sprintf("%s%s?first=%d", TwitchAPIBaseURL, CategoriesEndpoint, limit)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set required headers
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Client-Id", c.clientID)
	req.Header.Set("Content-Type", "application/json")

	// Make the request
	log.Debug().Str("url", url).Int("limit", limit).Str("sort", sortBy).Msg("Making request to Twitch API for categories")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Str("url", url).Msg("Failed to make request to Twitch API for categories")
		return nil, fmt.Errorf("failed to make request to Twitch API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Handle HTTP error status codes
	if resp.StatusCode != http.StatusOK {
		//TODO: is there a way to make this simpler like a string builder?
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Str("url", url).
			Msg("Twitch API returned error status for categories")
		return nil, fmt.Errorf("Twitch API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse JSON response
	var categoriesResponse CategoriesResponse
	if err := json.Unmarshal(body, &categoriesResponse); err != nil {
		//TODO: is there a way to make this simpler like a string builder?
		log.Error().
			Err(err).
			Str("response_body", string(body)).
			Msg("Failed to parse JSON response from Twitch API for categories")
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	//TODO: is there a way to make this simpler like a string builder?
	log.Debug().
		Int("category_count", len(categoriesResponse.Data)).
		Int("requested_limit", limit).
		Str("sort", sortBy).
		Msg("Successfully fetched categories from Twitch API")

	return &categoriesResponse, nil
}

// GetUserFollows fetches the channels that a user follows from Twitch API
func (c *ClientImpl) GetUserFollows(ctx context.Context, userID string, userToken string) (*FollowsResponse, error) {
	// Validate required parameters
	if userID == "" {
		return nil, fmt.Errorf("userID is required")
	}
	if userToken == "" {
		return nil, fmt.Errorf("userToken is required")
	}

	// Build request URL with user_id parameter
	url := fmt.Sprintf("%s%s?user_id=%s", TwitchAPIBaseURL, FollowsEndpoint, userID)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set required headers - use user token for authorization
	req.Header.Set("Authorization", "Bearer "+userToken)
	req.Header.Set("Client-Id", c.clientID)
	req.Header.Set("Content-Type", "application/json")

	// Make the request
	log.Debug().Str("url", url).Str("user_id", userID).Msg("Making request to Twitch API for user follows")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Str("url", url).Msg("Failed to make request to Twitch API for user follows")
		return nil, fmt.Errorf("failed to make request to Twitch API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Handle HTTP error status codes
	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("response_body", string(body)).
			Str("url", url).
			Msg("Twitch API returned error status for user follows")
		return nil, fmt.Errorf("twitch API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse JSON response
	var followsResponse FollowsResponse
	if err := json.Unmarshal(body, &followsResponse); err != nil {
		log.Error().
			Err(err).
			Str("response_body", string(body)).
			Msg("Failed to parse JSON response from Twitch API for user follows")
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	log.Debug().
		Int("follows_count", len(followsResponse.Data)).
		Int("total_follows", followsResponse.Total).
		Str("user_id", userID).
		Msg("Successfully fetched user follows from Twitch API")

	return &followsResponse, nil
}

// buildStreamsURL constructs the Twitch API URL with query parameters
func (c *ClientImpl) buildStreamsURL(params StreamsQueryParams) string {
	baseURL := fmt.Sprintf("%s%s", TwitchAPIBaseURL, StreamsEndpoint)
	queryParams := []string{}

	// Add limit parameter
	if params.Limit > 0 {
		queryParams = append(queryParams, fmt.Sprintf("first=%d", params.Limit))
	}

	// Add game_id parameter if provided
	if params.GameID != "" {
		queryParams = append(queryParams, fmt.Sprintf("game_id=%s", params.GameID))
	}

	// Note: Twitch API doesn't support custom sorting beyond default (by viewer count)
	// The "recent" sort option is handled client-side after receiving the response

	if len(queryParams) > 0 {
		return fmt.Sprintf("%s?%s", baseURL, strings.Join(queryParams, "&"))
	}

	return baseURL
}

// sortStreamsByRecent sorts streams by started_at timestamp (most recent first)
func (c *ClientImpl) sortStreamsByRecent(streams []Stream) {
	if len(streams) <= 1 {
		return
	}

	// Sort streams by started_at timestamp in descending order (most recent first)
	sort.Slice(streams, func(i, j int) bool {
		// Parse timestamps for comparison
		timeI, errI := time.Parse(time.RFC3339, streams[i].StartedAt)
		timeJ, errJ := time.Parse(time.RFC3339, streams[j].StartedAt)

		// If parsing fails, maintain original order
		if errI != nil || errJ != nil {
			return false
		}

		// Return true if i is more recent than j (for descending order)
		return timeI.After(timeJ)
	})
}
