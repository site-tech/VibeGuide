package twitch

import (
	"context"
	"net/http"
	"time"
)

// API URLs and endpoints
const (
	TwitchAPIBaseURL = "https://api.twitch.tv/helix"
	TwitchOAuthURL   = "https://id.twitch.tv/oauth2/token"
	StreamsEndpoint  = "/streams"
)

// Default values
const (
	DefaultStreamLimit = 100
	MaxStreamLimit     = 1000
	HTTPTimeout        = 10 // seconds
)

// Stream represents a Twitch stream with essential information
type Stream struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	UserLogin    string `json:"user_login"`
	UserName     string `json:"user_name"`
	GameID       string `json:"game_id"`
	GameName     string `json:"game_name"`
	Type         string `json:"type"`
	Title        string `json:"title"`
	ViewerCount  int    `json:"viewer_count"`
	StartedAt    string `json:"started_at"`
	Language     string `json:"language"`
	ThumbnailURL string `json:"thumbnail_url"`
}

// StreamsResponse represents the response from Twitch API for streams
type StreamsResponse struct {
	Data []Stream `json:"data"`
}

// Client interface defines the core Twitch client functionality
type Client interface {
	GetTopStreams(ctx context.Context, limit int) (*StreamsResponse, error)
}

// OAuthManager interface defines OAuth token management functionality
type OAuthManager interface {
	GetToken(ctx context.Context) (string, error)
	IsTokenValid() bool
}

// Token represents an OAuth access token
type Token struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	AcquiredAt  time.Time // When the token was acquired for expiration validation
}

// ClientImpl is the concrete implementation of the Twitch client
type ClientImpl struct {
	clientID     string
	clientSecret string
	oauthManager OAuthManager
	httpClient   *http.Client
}

// OAuthManagerImpl is the concrete implementation of OAuth manager
type OAuthManagerImpl struct {
	clientID     string
	clientSecret string
	token        *Token
	httpClient   *http.Client
}
