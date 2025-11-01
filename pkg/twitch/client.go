package twitch

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
