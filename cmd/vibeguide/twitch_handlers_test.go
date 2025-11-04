package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/site-tech/VibeGuide/pkg/mytypes"
	"github.com/site-tech/VibeGuide/pkg/twitch"
)

// mockTwitchClient implements twitch.Client for testing
type mockTwitchClient struct {
	streams    *twitch.StreamsResponse
	categories *twitch.CategoriesResponse
	shouldErr  bool
	errMsg     string
}

func (m *mockTwitchClient) GetTopStreams(ctx context.Context, limit int) (*twitch.StreamsResponse, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return m.streams, nil
}

func (m *mockTwitchClient) GetCategories(ctx context.Context, limit int, sortBy string) (*twitch.CategoriesResponse, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return m.categories, nil
}

func (m *mockTwitchClient) GetAuthorizationURL(redirectURI, state string, scopes []string) string {
	return "https://id.twitch.tv/oauth2/authorize?client_id=test&redirect_uri=" + redirectURI + "&state=" + state
}

func (m *mockTwitchClient) ExchangeCodeForToken(ctx context.Context, code, redirectURI string) (*twitch.UserToken, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.UserToken{AccessToken: "test_token"}, nil
}

func (m *mockTwitchClient) ValidateToken(ctx context.Context, accessToken string) (*twitch.TokenValidation, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.TokenValidation{UserID: "test_user"}, nil
}

func (m *mockTwitchClient) GetUserInfo(ctx context.Context, accessToken string) (*twitch.User, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.User{ID: "test_user", Login: "test_login"}, nil
}

func (m *mockTwitchClient) GetStreams(ctx context.Context, params twitch.StreamsQueryParams) (*twitch.StreamsResponse, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return m.streams, nil
}

func (m *mockTwitchClient) GetUserFollows(ctx context.Context, userID string, userToken string) (*twitch.FollowsResponse, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.FollowsResponse{
		Data: []twitch.Follow{
			{
				BroadcasterID:    "123456",
				BroadcasterLogin: "teststreamer",
				BroadcasterName:  "TestStreamer",
				FollowedAt:       "2023-01-01T00:00:00Z",
			},
		},
		Total: 1,
	}, nil
}

// mockTwitchClientWithLimit implements twitch.Client for testing and tracks the limit parameter
type mockTwitchClientWithLimit struct {
	streams       *twitch.StreamsResponse
	categories    *twitch.CategoriesResponse
	shouldErr     bool
	errMsg        string
	receivedLimit *int
}

func (m *mockTwitchClientWithLimit) GetTopStreams(ctx context.Context, limit int) (*twitch.StreamsResponse, error) {
	if m.receivedLimit != nil {
		*m.receivedLimit = limit
	}
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return m.streams, nil
}

func (m *mockTwitchClientWithLimit) GetCategories(ctx context.Context, limit int, sortBy string) (*twitch.CategoriesResponse, error) {
	if m.receivedLimit != nil {
		*m.receivedLimit = limit
	}
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return m.categories, nil
}

func (m *mockTwitchClientWithLimit) GetAuthorizationURL(redirectURI, state string, scopes []string) string {
	return "https://id.twitch.tv/oauth2/authorize?client_id=test&redirect_uri=" + redirectURI + "&state=" + state
}

func (m *mockTwitchClientWithLimit) ExchangeCodeForToken(ctx context.Context, code, redirectURI string) (*twitch.UserToken, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.UserToken{AccessToken: "test_token"}, nil
}

func (m *mockTwitchClientWithLimit) ValidateToken(ctx context.Context, accessToken string) (*twitch.TokenValidation, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.TokenValidation{UserID: "test_user"}, nil
}

func (m *mockTwitchClientWithLimit) GetUserInfo(ctx context.Context, accessToken string) (*twitch.User, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.User{ID: "test_user", Login: "test_login"}, nil
}

func (m *mockTwitchClientWithLimit) GetStreams(ctx context.Context, params twitch.StreamsQueryParams) (*twitch.StreamsResponse, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return m.streams, nil
}

func (m *mockTwitchClientWithLimit) GetUserFollows(ctx context.Context, userID string, userToken string) (*twitch.FollowsResponse, error) {
	if m.shouldErr {
		return nil, fmt.Errorf("%s", m.errMsg)
	}
	return &twitch.FollowsResponse{
		Data: []twitch.Follow{
			{
				BroadcasterID:    "123456",
				BroadcasterLogin: "teststreamer",
				BroadcasterName:  "TestStreamer",
				FollowedAt:       "2023-01-01T00:00:00Z",
			},
		},
		Total: 1,
	}, nil
}

// createTestStreamsResponse creates a sample streams response for testing
func createTestStreamsResponse() *twitch.StreamsResponse {
	return &twitch.StreamsResponse{
		Data: []twitch.Stream{
			{
				ID:           "123456789",
				UserID:       "987654321",
				UserLogin:    "teststreamer",
				UserName:     "TestStreamer",
				GameID:       "509658",
				GameName:     "Just Chatting",
				Type:         "live",
				Title:        "Test Stream Title",
				ViewerCount:  1500,
				StartedAt:    "2023-01-01T12:00:00Z",
				Language:     "en",
				ThumbnailURL: "https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-{width}x{height}.jpg",
				Tags:         []string{"English", "Chatting", "Interactive"},
			},
			{
				ID:           "987654321",
				UserID:       "123456789",
				UserLogin:    "anotherstreamer",
				UserName:     "AnotherStreamer",
				GameID:       "32982",
				GameName:     "Grand Theft Auto V",
				Type:         "live",
				Title:        "Another Test Stream",
				ViewerCount:  2500,
				StartedAt:    "2023-01-01T11:30:00Z",
				Language:     "en",
				ThumbnailURL: "https://static-cdn.jtvnw.net/previews-ttv/live_user_anotherstreamer-{width}x{height}.jpg",
				Tags:         []string{"GTA", "Roleplay", "English"},
			},
		},
	}
}

// setupTestRouter creates a test router with middleware for testing handlers
func setupTestRouter(twitchClient twitch.Client) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(apiVersionContext("v1"))
	r.Mount("/twitch", twitchRouter(twitchClient))
	return r
}

func TestGetTopStreamsHandler_Success(t *testing.T) {
	// Create mock client with successful response
	mockClient := &mockTwitchClient{
		streams:   createTestStreamsResponse(),
		shouldErr: false,
	}

	// Setup router
	router := setupTestRouter(mockClient)

	// Create test request
	req := httptest.NewRequest("GET", "/twitch/streams/top", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Check status code
	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Check content type
	expectedContentType := "application/json"
	if contentType := w.Header().Get("Content-Type"); contentType != expectedContentType {
		t.Errorf("Expected Content-Type %s, got %s", expectedContentType, contentType)
	}

	// Parse response
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Verify response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}

	// Verify streams data
	streamsData, ok := response.Data.(*twitch.StreamsResponse)
	if !ok {
		// Try to unmarshal the data field as StreamsResponse
		dataBytes, err := json.Marshal(response.Data)
		if err != nil {
			t.Fatalf("Failed to marshal response data: %v", err)
		}

		var streams twitch.StreamsResponse
		if err := json.Unmarshal(dataBytes, &streams); err != nil {
			t.Fatalf("Failed to unmarshal streams data: %v", err)
		}
		streamsData = &streams
	}

	if len(streamsData.Data) != 2 {
		t.Errorf("Expected 2 streams, got %d", len(streamsData.Data))
	}

	// Verify first stream
	firstStream := streamsData.Data[0]
	if firstStream.ID != "123456789" {
		t.Errorf("Expected stream ID '123456789', got '%s'", firstStream.ID)
	}
	if firstStream.UserLogin != "teststreamer" {
		t.Errorf("Expected user login 'teststreamer', got '%s'", firstStream.UserLogin)
	}
	if firstStream.ViewerCount != 1500 {
		t.Errorf("Expected viewer count 1500, got %d", firstStream.ViewerCount)
	}

	// Verify tags field
	expectedTags := []string{"English", "Chatting", "Interactive"}
	if len(firstStream.Tags) != len(expectedTags) {
		t.Errorf("Expected %d tags, got %d", len(expectedTags), len(firstStream.Tags))
	}
	for i, expectedTag := range expectedTags {
		if i >= len(firstStream.Tags) || firstStream.Tags[i] != expectedTag {
			t.Errorf("Expected tag[%d] '%s', got '%s'", i, expectedTag, firstStream.Tags[i])
		}
	}
}

func TestGetTopStreamsHandler_WithCountParameter(t *testing.T) {
	// Create mock client that tracks the limit parameter
	var receivedLimit int

	// Create a custom mock that captures the limit
	mockClient := &mockTwitchClientWithLimit{
		streams:       createTestStreamsResponse(),
		shouldErr:     false,
		receivedLimit: &receivedLimit,
	}

	router := setupTestRouter(mockClient)

	// Test with count parameter
	req := httptest.NewRequest("GET", "/twitch/streams/top?count=50", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	if receivedLimit != 50 {
		t.Errorf("Expected limit parameter 50, got %d", receivedLimit)
	}
}

func TestGetTopStreamsHandler_InvalidCountParameter(t *testing.T) {
	tests := []struct {
		name          string
		queryParam    string
		expectedLimit int
	}{
		{
			name:          "Invalid string parameter",
			queryParam:    "?count=invalid",
			expectedLimit: twitch.DefaultStreamLimit,
		},
		{
			name:          "Negative parameter",
			queryParam:    "?count=-5",
			expectedLimit: twitch.DefaultStreamLimit,
		},
		{
			name:          "Zero parameter",
			queryParam:    "?count=0",
			expectedLimit: twitch.DefaultStreamLimit,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock client that tracks the limit parameter for each test
			var receivedLimit int
			mockClient := &mockTwitchClientWithLimit{
				streams:       createTestStreamsResponse(),
				shouldErr:     false,
				receivedLimit: &receivedLimit,
			}

			router := setupTestRouter(mockClient)

			req := httptest.NewRequest("GET", "/twitch/streams/top"+tt.queryParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
			}

			if receivedLimit != tt.expectedLimit {
				t.Errorf("Expected limit parameter %d, got %d", tt.expectedLimit, receivedLimit)
			}
		})
	}
}

func TestGetTopStreamsHandler_OAuthError(t *testing.T) {
	// Create mock client that returns OAuth error
	mockClient := &mockTwitchClient{
		shouldErr: true,
		errMsg:    "failed to get OAuth token: oauth error",
	}

	router := setupTestRouter(mockClient)

	req := httptest.NewRequest("GET", "/twitch/streams/top", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 503 Service Unavailable for OAuth errors
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, w.Code)
	}

	// Parse error response
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse error response JSON: %v", err)
	}

	// Verify error response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set in error response")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}

	// Verify error message is present
	errorMsg, ok := response.Data.(string)
	if !ok {
		t.Errorf("Expected error message string, got %T", response.Data)
	}
	if errorMsg == "" {
		t.Error("Expected non-empty error message")
	}
}

func TestGetTopStreamsHandler_TwitchAPIError(t *testing.T) {
	tests := []struct {
		name               string
		errorMsg           string
		expectedStatusCode int
	}{
		{
			name:               "Twitch API 401 Unauthorized",
			errorMsg:           "Twitch API returned error status 401: Unauthorized",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Twitch API 404 Not Found",
			errorMsg:           "Twitch API returned error status 404: Not Found",
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:               "Twitch API 429 Rate Limited",
			errorMsg:           "Twitch API returned error status 429: Too Many Requests",
			expectedStatusCode: http.StatusTooManyRequests,
		},
		{
			name:               "Twitch API 500 Server Error",
			errorMsg:           "Twitch API returned error status 500: Internal Server Error",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Network connection error",
			errorMsg:           "failed to make request to Twitch API: connection timeout",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "JSON parsing error",
			errorMsg:           "failed to parse JSON response: invalid character",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Generic error",
			errorMsg:           "unknown error occurred",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockTwitchClient{
				shouldErr: true,
				errMsg:    tt.errorMsg,
			}

			router := setupTestRouter(mockClient)

			req := httptest.NewRequest("GET", "/twitch/streams/top", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatusCode {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatusCode, w.Code)
			}

			// Parse error response
			var response mytypes.APIHandlerResp
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("Failed to parse error response JSON: %v", err)
			}

			// Verify error response structure
			if response.TransactionId == "" {
				t.Error("Expected transaction_id to be set in error response")
			}
			if response.ApiVersion != "v1" {
				t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
			}

			// Verify error message is present
			errorMsg, ok := response.Data.(string)
			if !ok {
				t.Errorf("Expected error message string, got %T", response.Data)
			}
			if errorMsg == "" {
				t.Error("Expected non-empty error message")
			}
		})
	}
}

func TestTwitchRouter_MountedCorrectly(t *testing.T) {
	mockClient := &mockTwitchClient{
		streams:   createTestStreamsResponse(),
		shouldErr: false,
	}

	router := setupTestRouter(mockClient)

	// Test that the route is properly mounted
	req := httptest.NewRequest("GET", "/twitch/streams/top", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

func TestTwitchRouter_InvalidRoute(t *testing.T) {
	mockClient := &mockTwitchClient{
		streams:   createTestStreamsResponse(),
		shouldErr: false,
	}

	router := setupTestRouter(mockClient)

	// Test invalid route
	req := httptest.NewRequest("GET", "/twitch/invalid", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 404 for invalid routes
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestTwitchRouter_CategoriesEndpoint(t *testing.T) {
	// Create mock categories response
	mockCategories := &twitch.CategoriesResponse{
		Data: []twitch.Category{
			{
				ID:        "509658",
				Name:      "Just Chatting",
				BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
				IGDBId:    "123",
			},
		},
	}

	mockClient := &mockTwitchClient{
		categories: mockCategories,
		shouldErr:  false,
	}

	router := setupTestRouter(mockClient)

	// Test categories route
	req := httptest.NewRequest("GET", "/twitch/categories", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Parse response to verify it's properly formatted
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Verify response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}
}

func TestGetCategoriesHandler_Success(t *testing.T) {
	// Create mock categories response
	mockCategories := &twitch.CategoriesResponse{
		Data: []twitch.Category{
			{
				ID:        "509658",
				Name:      "Just Chatting",
				BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-{width}x{height}.jpg",
				IGDBId:    "123456",
			},
			{
				ID:        "32982",
				Name:      "Grand Theft Auto V",
				BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/Grand%20Theft%20Auto%20V-{width}x{height}.jpg",
				IGDBId:    "1020",
			},
		},
	}

	mockClient := &mockTwitchClient{
		categories: mockCategories,
		shouldErr:  false,
	}

	router := setupTestRouter(mockClient)

	// Create test request
	req := httptest.NewRequest("GET", "/twitch/categories", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Check status code
	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Check content type
	expectedContentType := "application/json"
	if contentType := w.Header().Get("Content-Type"); contentType != expectedContentType {
		t.Errorf("Expected Content-Type %s, got %s", expectedContentType, contentType)
	}

	// Parse response
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Verify response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}

	// Verify categories data
	categoriesData, ok := response.Data.(*twitch.CategoriesResponse)
	if !ok {
		// Try to unmarshal the data field as CategoriesResponse
		dataBytes, err := json.Marshal(response.Data)
		if err != nil {
			t.Fatalf("Failed to marshal response data: %v", err)
		}

		var categories twitch.CategoriesResponse
		if err := json.Unmarshal(dataBytes, &categories); err != nil {
			t.Fatalf("Failed to unmarshal categories data: %v", err)
		}
		categoriesData = &categories
	}

	if len(categoriesData.Data) != 2 {
		t.Errorf("Expected 2 categories, got %d", len(categoriesData.Data))
	}

	// Verify first category
	firstCategory := categoriesData.Data[0]
	if firstCategory.ID != "509658" {
		t.Errorf("Expected category ID '509658', got '%s'", firstCategory.ID)
	}
	if firstCategory.Name != "Just Chatting" {
		t.Errorf("Expected category name 'Just Chatting', got '%s'", firstCategory.Name)
	}
}

func TestGetCategoriesHandler_WithSortParameter(t *testing.T) {
	// Create mock categories response
	mockCategories := &twitch.CategoriesResponse{
		Data: []twitch.Category{
			{
				ID:        "509658",
				Name:      "Just Chatting",
				BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-{width}x{height}.jpg",
				IGDBId:    "123456",
			},
		},
	}

	mockClient := &mockTwitchClient{
		categories: mockCategories,
		shouldErr:  false,
	}

	router := setupTestRouter(mockClient)

	// Test with sort=top parameter
	req := httptest.NewRequest("GET", "/twitch/categories?sort=top", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Parse response to ensure it's valid
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set")
	}
}

func TestGetCategoriesHandler_WithLimitParameter(t *testing.T) {
	// Create mock client that tracks the limit parameter
	var receivedLimit int

	mockCategories := &twitch.CategoriesResponse{
		Data: []twitch.Category{
			{
				ID:        "509658",
				Name:      "Just Chatting",
				BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-{width}x{height}.jpg",
				IGDBId:    "123456",
			},
		},
	}

	mockClient := &mockTwitchClientWithLimit{
		categories:    mockCategories,
		shouldErr:     false,
		receivedLimit: &receivedLimit,
	}

	router := setupTestRouter(mockClient)

	// Test with limit parameter
	req := httptest.NewRequest("GET", "/twitch/categories?limit=30", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	if receivedLimit != 30 {
		t.Errorf("Expected limit parameter 30, got %d", receivedLimit)
	}
}

func TestGetCategoriesHandler_InvalidLimitParameter(t *testing.T) {
	tests := []struct {
		name          string
		queryParam    string
		expectedLimit int
	}{
		{
			name:          "Invalid string parameter",
			queryParam:    "?limit=invalid",
			expectedLimit: twitch.DefaultCategoryLimit,
		},
		{
			name:          "Negative parameter",
			queryParam:    "?limit=-5",
			expectedLimit: twitch.DefaultCategoryLimit,
		},
		{
			name:          "Zero parameter",
			queryParam:    "?limit=0",
			expectedLimit: twitch.DefaultCategoryLimit,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock client that tracks the limit parameter for each test
			var receivedLimit int
			mockCategories := &twitch.CategoriesResponse{
				Data: []twitch.Category{
					{
						ID:        "509658",
						Name:      "Just Chatting",
						BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-{width}x{height}.jpg",
						IGDBId:    "123456",
					},
				},
			}

			mockClient := &mockTwitchClientWithLimit{
				categories:    mockCategories,
				shouldErr:     false,
				receivedLimit: &receivedLimit,
			}

			router := setupTestRouter(mockClient)

			req := httptest.NewRequest("GET", "/twitch/categories"+tt.queryParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
			}

			if receivedLimit != tt.expectedLimit {
				t.Errorf("Expected limit parameter %d, got %d", tt.expectedLimit, receivedLimit)
			}
		})
	}
}

func TestGetCategoriesHandler_OAuthError(t *testing.T) {
	// Create mock client that returns OAuth error
	mockClient := &mockTwitchClient{
		shouldErr: true,
		errMsg:    "failed to get OAuth token: oauth error",
	}

	router := setupTestRouter(mockClient)

	req := httptest.NewRequest("GET", "/twitch/categories", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 503 Service Unavailable for OAuth errors
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, w.Code)
	}

	// Parse error response
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse error response JSON: %v", err)
	}

	// Verify error response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set in error response")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}

	// Verify error message is present
	errorMsg, ok := response.Data.(string)
	if !ok {
		t.Errorf("Expected error message string, got %T", response.Data)
	}
	if errorMsg == "" {
		t.Error("Expected non-empty error message")
	}
}

func TestGetCategoriesHandler_InvalidSortParameter(t *testing.T) {
	mockCategories := &twitch.CategoriesResponse{
		Data: []twitch.Category{
			{
				ID:        "509658",
				Name:      "Just Chatting",
				BoxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-{width}x{height}.jpg",
				IGDBId:    "123456",
			},
		},
	}

	mockClient := &mockTwitchClient{
		categories: mockCategories,
		shouldErr:  false,
	}

	router := setupTestRouter(mockClient)

	// Test with invalid sort parameter
	req := httptest.NewRequest("GET", "/twitch/categories?sort=invalid", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 400 Bad Request for invalid sort parameter
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}

	// Parse error response
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse error response JSON: %v", err)
	}

	// Verify error response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set in error response")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}

	// Verify error message is present
	errorMsg, ok := response.Data.(string)
	if !ok {
		t.Errorf("Expected error message string, got %T", response.Data)
	}
	if !strings.Contains(errorMsg, "invalid sort parameter") {
		t.Errorf("Expected error message to contain 'invalid sort parameter', got: %s", errorMsg)
	}
}

func TestGetCategoriesHandler_TwitchAPIError(t *testing.T) {
	tests := []struct {
		name               string
		errorMsg           string
		expectedStatusCode int
	}{
		{
			name:               "Twitch API 401 Unauthorized",
			errorMsg:           "Twitch API returned error status 401: Unauthorized",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Twitch API 404 Not Found",
			errorMsg:           "Twitch API returned error status 404: Not Found",
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:               "Twitch API 429 Rate Limited",
			errorMsg:           "Twitch API returned error status 429: Too Many Requests",
			expectedStatusCode: http.StatusTooManyRequests,
		},
		{
			name:               "Twitch API 500 Server Error",
			errorMsg:           "Twitch API returned error status 500: Internal Server Error",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Network connection error",
			errorMsg:           "failed to make request to Twitch API: connection timeout",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "JSON parsing error",
			errorMsg:           "failed to parse JSON response: invalid character",
			expectedStatusCode: http.StatusBadGateway,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockTwitchClient{
				shouldErr: true,
				errMsg:    tt.errorMsg,
			}

			router := setupTestRouter(mockClient)

			req := httptest.NewRequest("GET", "/twitch/categories", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatusCode {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatusCode, w.Code)
			}

			// Parse error response
			var response mytypes.APIHandlerResp
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("Failed to parse error response JSON: %v", err)
			}

			// Verify error response structure
			if response.TransactionId == "" {
				t.Error("Expected transaction_id to be set in error response")
			}
			if response.ApiVersion != "v1" {
				t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
			}

			// Verify error message is present
			errorMsg, ok := response.Data.(string)
			if !ok {
				t.Errorf("Expected error message string, got %T", response.Data)
			}
			if errorMsg == "" {
				t.Error("Expected non-empty error message")
			}
		})
	}
}

func TestGetStreamsHandler_Success(t *testing.T) {
	// Create mock client with successful response
	mockClient := &mockTwitchClient{
		streams:   createTestStreamsResponse(),
		shouldErr: false,
	}

	// Setup router
	router := setupTestRouter(mockClient)

	// Create test request
	req := httptest.NewRequest("GET", "/twitch/streams", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Check status code
	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Check content type
	expectedContentType := "application/json"
	if contentType := w.Header().Get("Content-Type"); contentType != expectedContentType {
		t.Errorf("Expected Content-Type %s, got %s", expectedContentType, contentType)
	}

	// Parse response
	var response mytypes.APIHandlerResp
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Verify response structure
	if response.TransactionId == "" {
		t.Error("Expected transaction_id to be set")
	}
	if response.ApiVersion != "v1" {
		t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
	}

	// Verify streams data
	streamsData, ok := response.Data.(*twitch.StreamsResponse)
	if !ok {
		// Try to unmarshal the data field as StreamsResponse
		dataBytes, err := json.Marshal(response.Data)
		if err != nil {
			t.Fatalf("Failed to marshal response data: %v", err)
		}

		var streams twitch.StreamsResponse
		if err := json.Unmarshal(dataBytes, &streams); err != nil {
			t.Fatalf("Failed to unmarshal streams data: %v", err)
		}
		streamsData = &streams
	}

	if len(streamsData.Data) != 2 {
		t.Errorf("Expected 2 streams, got %d", len(streamsData.Data))
	}
}

func TestGetStreamsHandler_WithParameters(t *testing.T) {
	tests := []struct {
		name        string
		queryParams string
		expectError bool
	}{
		{
			name:        "With limit parameter",
			queryParams: "?limit=10",
			expectError: false,
		},
		{
			name:        "With game_id parameter",
			queryParams: "?game_id=12345",
			expectError: false,
		},
		{
			name:        "With sort parameter",
			queryParams: "?sort=recent",
			expectError: false,
		},
		{
			name:        "With all parameters",
			queryParams: "?limit=5&game_id=67890&sort=viewers",
			expectError: false,
		},
		{
			name:        "With invalid limit",
			queryParams: "?limit=invalid",
			expectError: true,
		},
		{
			name:        "With invalid limit range",
			queryParams: "?limit=200",
			expectError: true,
		},
		{
			name:        "With invalid game_id",
			queryParams: "?game_id=invalid",
			expectError: true,
		},
		{
			name:        "With invalid sort",
			queryParams: "?sort=invalid",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockTwitchClient{
				streams:   createTestStreamsResponse(),
				shouldErr: false,
			}

			router := setupTestRouter(mockClient)

			req := httptest.NewRequest("GET", "/twitch/streams"+tt.queryParams, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if tt.expectError {
				if w.Code == http.StatusOK {
					t.Errorf("Expected error status code, got %d", w.Code)
				}
			} else {
				if w.Code != http.StatusOK {
					t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
				}
			}
		})
	}
}

func TestGetStreamsHandler_ErrorScenarios(t *testing.T) {
	tests := []struct {
		name               string
		errorMsg           string
		expectedStatusCode int
	}{
		{
			name:               "OAuth error",
			errorMsg:           "failed to get OAuth token: oauth error",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Twitch API 401 error",
			errorMsg:           "twitch API returned error status 401: Unauthorized",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Twitch API 404 error",
			errorMsg:           "twitch API returned error status 404: Not Found",
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:               "Twitch API 429 error",
			errorMsg:           "twitch API returned error status 429: Too Many Requests",
			expectedStatusCode: http.StatusTooManyRequests,
		},
		{
			name:               "Network error",
			errorMsg:           "failed to make request to Twitch API: connection timeout",
			expectedStatusCode: http.StatusBadGateway,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockTwitchClient{
				shouldErr: true,
				errMsg:    tt.errorMsg,
			}

			router := setupTestRouter(mockClient)

			req := httptest.NewRequest("GET", "/twitch/streams", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatusCode {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatusCode, w.Code)
			}

			// Parse error response
			var response mytypes.APIHandlerResp
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("Failed to parse error response JSON: %v", err)
			}

			// Verify error response structure
			if response.TransactionId == "" {
				t.Error("Expected transaction_id to be set in error response")
			}
			if response.ApiVersion != "v1" {
				t.Errorf("Expected api_version 'v1', got '%s'", response.ApiVersion)
			}
		})
	}
}

func TestGetStreamsHandler_BackwardCompatibility(t *testing.T) {
	// Test that the new endpoint maintains the same response structure as the old one
	mockClient := &mockTwitchClient{
		streams:   createTestStreamsResponse(),
		shouldErr: false,
	}

	router := setupTestRouter(mockClient)

	// Test new endpoint
	reqNew := httptest.NewRequest("GET", "/twitch/streams?limit=20", nil)
	wNew := httptest.NewRecorder()
	router.ServeHTTP(wNew, reqNew)

	// Test old endpoint
	reqOld := httptest.NewRequest("GET", "/twitch/streams/top?count=20", nil)
	wOld := httptest.NewRecorder()
	router.ServeHTTP(wOld, reqOld)

	// Both should return 200 OK
	if wNew.Code != http.StatusOK {
		t.Errorf("New endpoint: Expected status code %d, got %d", http.StatusOK, wNew.Code)
	}
	if wOld.Code != http.StatusOK {
		t.Errorf("Old endpoint: Expected status code %d, got %d", http.StatusOK, wOld.Code)
	}

	// Parse both responses
	var responseNew, responseOld mytypes.APIHandlerResp
	if err := json.Unmarshal(wNew.Body.Bytes(), &responseNew); err != nil {
		t.Fatalf("Failed to parse new endpoint response JSON: %v", err)
	}
	if err := json.Unmarshal(wOld.Body.Bytes(), &responseOld); err != nil {
		t.Fatalf("Failed to parse old endpoint response JSON: %v", err)
	}

	// Verify both have the same response structure
	if responseNew.ApiVersion != responseOld.ApiVersion {
		t.Errorf("API versions don't match: new=%s, old=%s", responseNew.ApiVersion, responseOld.ApiVersion)
	}

	// Both should have transaction IDs
	if responseNew.TransactionId == "" {
		t.Error("New endpoint: Expected transaction_id to be set")
	}
	if responseOld.TransactionId == "" {
		t.Error("Old endpoint: Expected transaction_id to be set")
	}
}

func TestDetermineErrorStatusCode(t *testing.T) {
	tests := []struct {
		name               string
		errorMsg           string
		expectedStatusCode int
	}{
		{
			name:               "OAuth error",
			errorMsg:           "failed to get OAuth token",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Token error",
			errorMsg:           "invalid token provided",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Unauthorized error",
			errorMsg:           "unauthorized access",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Rate limit error",
			errorMsg:           "rate limit exceeded",
			expectedStatusCode: http.StatusTooManyRequests,
		},
		{
			name:               "Too many requests error",
			errorMsg:           "too many requests",
			expectedStatusCode: http.StatusTooManyRequests,
		},
		{
			name:               "Twitch API 400 error",
			errorMsg:           "Twitch API returned error status 400",
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			name:               "Twitch API 401 error",
			errorMsg:           "Twitch API returned error status 401",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Twitch API 403 error",
			errorMsg:           "Twitch API returned error status 403",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
		{
			name:               "Twitch API 404 error",
			errorMsg:           "Twitch API returned error status 404",
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:               "Twitch API 429 error",
			errorMsg:           "Twitch API returned error status 429",
			expectedStatusCode: http.StatusTooManyRequests,
		},
		{
			name:               "Twitch API 500 error",
			errorMsg:           "Twitch API returned error status 500",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Connection error",
			errorMsg:           "connection refused",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Timeout error",
			errorMsg:           "request timeout",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Network error",
			errorMsg:           "network unreachable",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "JSON parsing error",
			errorMsg:           "failed to parse JSON response",
			expectedStatusCode: http.StatusBadGateway,
		},
		{
			name:               "Unknown error",
			errorMsg:           "some unknown error",
			expectedStatusCode: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := fmt.Errorf("%s", tt.errorMsg)
			statusCode := determineErrorStatusCode(err)

			if statusCode != tt.expectedStatusCode {
				t.Errorf("Expected status code %d, got %d for error: %s", tt.expectedStatusCode, statusCode, tt.errorMsg)
			}
		})
	}
}
