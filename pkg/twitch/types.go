package twitch

import (
	"context"
	"net/http"
	"time"
)

// API URLs and endpoints
const (
	TwitchAPIBaseURL     = "https://api.twitch.tv/helix"
	TwitchOAuthURL       = "https://id.twitch.tv/oauth2/token"
	TwitchOAuthAuthorize = "https://id.twitch.tv/oauth2/authorize"
	TwitchOAuthValidate  = "https://id.twitch.tv/oauth2/validate"
	StreamsEndpoint      = "/streams"
	UsersEndpoint        = "/users"
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
	GetAuthorizationURL(redirectURI, state string, scopes []string) string
	ExchangeCodeForToken(ctx context.Context, code, redirectURI string) (*UserToken, error)
	ValidateToken(ctx context.Context, accessToken string) (*TokenValidation, error)
	GetUserInfo(ctx context.Context, accessToken string) (*User, error)
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

// UserToken represents an OAuth token for a user (authorization code flow)
type UserToken struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	TokenType    string   `json:"token_type"`
	ExpiresIn    int      `json:"expires_in"`
	Scope        []string `json:"scope"`
}

// TokenValidation represents the response from token validation
type TokenValidation struct {
	ClientID  string   `json:"client_id"`
	Login     string   `json:"login"`
	Scopes    []string `json:"scopes"`
	UserID    string   `json:"user_id"`
	ExpiresIn int      `json:"expires_in"`
}

// User represents a Twitch user
type User struct {
	ID              string `json:"id"`
	Login           string `json:"login"`
	DisplayName     string `json:"display_name"`
	Type            string `json:"type"`
	BroadcasterType string `json:"broadcaster_type"`
	Description     string `json:"description"`
	ProfileImageURL string `json:"profile_image_url"`
	OfflineImageURL string `json:"offline_image_url"`
	Email           string `json:"email"`
	CreatedAt       string `json:"created_at"`
}

// UsersResponse represents the response from Twitch API for users
type UsersResponse struct {
	Data []User `json:"data"`
}
