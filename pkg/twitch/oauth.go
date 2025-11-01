package twitch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// NewOAuthManager creates a new OAuth manager instance
func NewOAuthManager(clientID, clientSecret string) OAuthManager {
	httpClient := &http.Client{
		Timeout: HTTPTimeout * time.Second,
	}

	return &OAuthManagerImpl{
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient:   httpClient,
	}
}

// GetToken retrieves a valid OAuth token
func (o *OAuthManagerImpl) GetToken(ctx context.Context) (string, error) {
	// If we have a valid token that hasn't expired, return it
	if o.IsTokenValid() {
		log.Debug().Msg("Using existing valid OAuth token")
		return o.token.AccessToken, nil
	}

	// Otherwise, acquire a new token
	log.Info().Msg("Acquiring new OAuth token from Twitch")
	err := o.refreshToken(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to acquire OAuth token from Twitch")
		return "", fmt.Errorf("failed to acquire OAuth token: %w", err)
	}

	log.Info().Msg("Successfully acquired new OAuth token")
	return o.token.AccessToken, nil
}

// IsTokenValid checks if the current token exists and hasn't expired
func (o *OAuthManagerImpl) IsTokenValid() bool {
	// Check if token exists
	if o.token == nil || o.token.AccessToken == "" {
		return false
	}

	// Check if token has expired (with 30 second buffer for safety)
	expirationTime := o.token.AcquiredAt.Add(time.Duration(o.token.ExpiresIn-30) * time.Second)
	return time.Now().Before(expirationTime)
}

// refreshToken acquires a new OAuth token using client credentials flow
func (o *OAuthManagerImpl) refreshToken(ctx context.Context) error {
	// Prepare the request data for client credentials flow
	data := url.Values{}
	data.Set("client_id", o.clientID)
	data.Set("client_secret", o.clientSecret)
	data.Set("grant_type", "client_credentials")

	// Create the HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", TwitchOAuthURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create OAuth request: %w", err)
	}

	// Set required headers
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Make the request
	resp, err := o.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("OAuth request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check for HTTP errors
	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status_code", resp.StatusCode).
			Str("status", resp.Status).
			Str("client_id", o.clientID).
			Msg("OAuth request to Twitch failed")
		return fmt.Errorf("OAuth request failed with status %d: %s", resp.StatusCode, resp.Status)
	}

	// Parse the response
	var token Token
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return fmt.Errorf("failed to parse OAuth response: %w", err)
	}

	// Validate the token
	if token.AccessToken == "" {
		log.Error().Msg("Received empty access token from Twitch OAuth endpoint")
		return fmt.Errorf("received empty access token from OAuth endpoint")
	}

	// Store the token with acquisition timestamp
	token.AcquiredAt = time.Now()
	o.token = &token

	log.Debug().
		Int("expires_in", token.ExpiresIn).
		Str("token_type", token.TokenType).
		Msg("OAuth token acquired and stored successfully")

	return nil
}
