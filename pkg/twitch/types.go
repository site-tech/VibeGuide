package twitch

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
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
	CategoriesEndpoint   = "/games/top"
	FollowsEndpoint      = "/channels/followed"
)

// TODO: move these to be environemnt variables
// Default values
const (
	DefaultStreamLimit   = 100
	MaxStreamLimit       = 1000
	DefaultCategoryLimit = 20
	MaxCategoryLimit     = 100
	HTTPTimeout          = 10 // seconds
)

// TODO: move these to be environemnt variables
// Query parameter validation constants
const (
	MinStreamQueryLimit = 1
	MaxStreamQueryLimit = 100
	DefaultQueryLimit   = 20
)

// Stream represents a Twitch stream with essential information
type Stream struct {
	ID           string   `json:"id"`
	UserID       string   `json:"user_id"`
	UserLogin    string   `json:"user_login"`
	UserName     string   `json:"user_name"`
	GameID       string   `json:"game_id"`
	GameName     string   `json:"game_name"`
	Type         string   `json:"type"`
	Title        string   `json:"title"`
	ViewerCount  int      `json:"viewer_count"`
	StartedAt    string   `json:"started_at"`
	Language     string   `json:"language"`
	ThumbnailURL string   `json:"thumbnail_url"`
	Tags         []string `json:"tags"`
}

// StreamsResponse represents the response from Twitch API for streams
type StreamsResponse struct {
	Data []Stream `json:"data"`
}

// StreamsQueryParams represents query parameters for the streams endpoint
type StreamsQueryParams struct {
	Limit  int    `json:"limit"`   // Number of streams to return (1-100, default: 20)
	GameID string `json:"game_id"` // Filter by specific game/category ID
	Sort   string `json:"sort"`    // Sorting method: "viewers" (default), "recent"
}

// Category represents a Twitch game category with game information
type Category struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	BoxArtURL string `json:"box_art_url"`
	IGDBId    string `json:"igdb_id"`
}

// CategoriesResponse represents the response from Twitch API for categories
type CategoriesResponse struct {
	Data []Category `json:"data"`
}

// Client interface defines the core Twitch client functionality
type Client interface {
	GetTopStreams(ctx context.Context, limit int) (*StreamsResponse, error)
	GetStreams(ctx context.Context, params StreamsQueryParams) (*StreamsResponse, error)
	GetAuthorizationURL(redirectURI, state string, scopes []string) string
	ExchangeCodeForToken(ctx context.Context, code, redirectURI string) (*UserToken, error)
	ValidateToken(ctx context.Context, accessToken string) (*TokenValidation, error)
	GetUserInfo(ctx context.Context, accessToken string) (*User, error)
	GetCategories(ctx context.Context, limit int, sortBy string) (*CategoriesResponse, error)
	GetUserFollows(ctx context.Context, userID string, userToken string) (*FollowsResponse, error)
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

// ValidateStreamsParams validates the StreamsQueryParams struct
func ValidateStreamsParams(params StreamsQueryParams) error {
	if err := ValidateLimit(params.Limit); err != nil {
		return err
	}

	if err := ValidateGameID(params.GameID); err != nil {
		return err
	}

	if err := ValidateSort(params.Sort); err != nil {
		return err
	}

	return nil
}

// ValidateLimit validates the limit parameter (1-100)
func ValidateLimit(limit int) error {
	if limit < MinStreamQueryLimit || limit > MaxStreamQueryLimit {
		return fmt.Errorf("limit must be between %d and %d, got %d", MinStreamQueryLimit, MaxStreamQueryLimit, limit)
	}
	return nil
}

// ValidateGameID validates the game_id parameter (numeric string if provided)
func ValidateGameID(gameID string) error {
	if gameID == "" {
		return nil // Empty game_id is valid (no filtering)
	}

	if _, err := strconv.Atoi(gameID); err != nil {
		return fmt.Errorf("game_id must be a numeric string, got %s", gameID)
	}

	return nil
}

// ValidateSort validates the sort parameter ("viewers" or "recent")
func ValidateSort(sort string) error {
	if sort == "" {
		return nil // Empty sort is valid (defaults to "viewers")
	}

	if sort != "viewers" && sort != "recent" {
		return fmt.Errorf("sort must be 'viewers' or 'recent', got %s", sort)
	}

	return nil
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

// Follow represents a channel that a user follows
type Follow struct {
	BroadcasterID    string `json:"broadcaster_id"`
	BroadcasterLogin string `json:"broadcaster_login"`
	BroadcasterName  string `json:"broadcaster_name"`
	FollowedAt       string `json:"followed_at"`
}

// Pagination represents pagination information from Twitch API
type Pagination struct {
	Cursor string `json:"cursor"`
}

// FollowsResponse represents the response from Twitch API for user follows
type FollowsResponse struct {
	Data       []Follow   `json:"data"`
	Total      int        `json:"total"`
	Pagination Pagination `json:"pagination"`
}
