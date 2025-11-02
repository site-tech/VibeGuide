package twitch

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

// mockOAuthManager implements OAuthManager for testing
type mockOAuthManager struct {
	token     string
	shouldErr bool
}

func (m *mockOAuthManager) GetToken(ctx context.Context) (string, error) {
	if m.shouldErr {
		return "", fmt.Errorf("mock oauth error")
	}
	return m.token, nil
}

func (m *mockOAuthManager) IsTokenValid() bool {
	return !m.shouldErr
}

// createTestClient creates a client with a mock OAuth manager for testing
func createTestClient(token string, shouldOAuthErr bool) *ClientImpl {
	return &ClientImpl{
		clientID:     "test_client_id",
		clientSecret: "test_client_secret",
		oauthManager: &mockOAuthManager{
			token:     token,
			shouldErr: shouldOAuthErr,
		},
		httpClient: &http.Client{
			Timeout: HTTPTimeout * time.Second,
		},
	}
}

// mockTransport redirects requests to our test server
type mockTransport struct {
	server *httptest.Server
}

func (m *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Redirect the request to our test server
	req.URL.Scheme = "http"
	req.URL.Host = m.server.URL[7:] // Remove "http://" prefix
	return http.DefaultTransport.RoundTrip(req)
}

func TestGetTopStreams_Success(t *testing.T) {
	// Load test data
	testData, err := os.ReadFile("testdata/sample_streams_response.json")
	if err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request headers
		if r.Header.Get("Authorization") != "Bearer test_token" {
			t.Errorf("Expected Authorization header 'Bearer test_token', got '%s'", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Client-Id") != "test_client_id" {
			t.Errorf("Expected Client-Id header 'test_client_id', got '%s'", r.Header.Get("Client-Id"))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type header 'application/json', got '%s'", r.Header.Get("Content-Type"))
		}

		// Verify query parameters
		if r.URL.Query().Get("first") != "20" {
			t.Errorf("Expected 'first' query parameter '20', got '%s'", r.URL.Query().Get("first"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(testData)
	}))
	defer server.Close()

	// Create client with mock server URL
	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	result, err := client.GetTopStreams(ctx, 20)

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}

	if len(result.Data) != 2 {
		t.Errorf("Expected 2 streams, got %d", len(result.Data))
	}

	// Verify first stream data
	firstStream := result.Data[0]
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
func TestGetTopStreams_OAuthError(t *testing.T) {
	client := createTestClient("", true) // OAuth manager will return error

	ctx := context.Background()
	result, err := client.GetTopStreams(ctx, 20)

	if err == nil {
		t.Fatal("Expected error due to OAuth failure, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on error, got: %v", result)
	}

	expectedErrMsg := "failed to get OAuth token"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}

func TestGetTopStreams_HTTPError(t *testing.T) {
	// Create mock server that returns HTTP error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Unauthorized","status":401,"message":"Invalid OAuth token"}`))
	}))
	defer server.Close()

	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	result, err := client.GetTopStreams(ctx, 20)

	if err == nil {
		t.Fatal("Expected error due to HTTP 401, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on error, got: %v", result)
	}

	expectedErrMsg := "Twitch API returned error status 401"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}
func TestGetTopStreams_InvalidJSON(t *testing.T) {
	// Create mock server that returns invalid JSON
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"invalid": json}`)) // Invalid JSON
	}))
	defer server.Close()

	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	result, err := client.GetTopStreams(ctx, 20)

	if err == nil {
		t.Fatal("Expected error due to invalid JSON, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on error, got: %v", result)
	}

	expectedErrMsg := "failed to parse JSON response"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}
func TestGetTopStreams_LimitValidation(t *testing.T) {
	testData, err := os.ReadFile("testdata/sample_streams_response.json")
	if err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	tests := []struct {
		name          string
		inputLimit    int
		expectedLimit string
	}{
		{
			name:          "Zero limit uses default",
			inputLimit:    0,
			expectedLimit: "100", // DefaultStreamLimit
		},
		{
			name:          "Negative limit uses default",
			inputLimit:    -5,
			expectedLimit: "100", // DefaultStreamLimit
		},
		{
			name:          "Valid limit is preserved",
			inputLimit:    50,
			expectedLimit: "50",
		},
		{
			name:          "Limit above max is capped",
			inputLimit:    2000,
			expectedLimit: "1000", // MaxStreamLimit
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				actualLimit := r.URL.Query().Get("first")
				if actualLimit != tt.expectedLimit {
					t.Errorf("Expected limit '%s', got '%s'", tt.expectedLimit, actualLimit)
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write(testData)
			}))
			defer server.Close()

			client := createTestClient("test_token", false)
			client.httpClient = &http.Client{
				Transport: &mockTransport{
					server: server,
				},
				Timeout: HTTPTimeout * time.Second,
			}

			ctx := context.Background()
			_, err := client.GetTopStreams(ctx, tt.inputLimit)

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}
func TestGetTopStreams_NetworkError(t *testing.T) {
	client := createTestClient("test_token", false)

	// Use an invalid URL to simulate network error
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: &httptest.Server{
				URL: "http://invalid-host-that-does-not-exist:9999",
			},
		},
		Timeout: 1 * time.Second, // Short timeout for faster test
	}

	ctx := context.Background()
	result, err := client.GetTopStreams(ctx, 20)

	if err == nil {
		t.Fatal("Expected network error, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on network error, got: %v", result)
	}

	expectedErrMsg := "failed to make request to Twitch API"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}

func TestGetCategories_Success(t *testing.T) {
	// Load test data
	testData, err := os.ReadFile("testdata/sample_categories_response.json")
	if err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request headers
		if r.Header.Get("Authorization") != "Bearer test_token" {
			t.Errorf("Expected Authorization header 'Bearer test_token', got '%s'", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Client-Id") != "test_client_id" {
			t.Errorf("Expected Client-Id header 'test_client_id', got '%s'", r.Header.Get("Client-Id"))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type header 'application/json', got '%s'", r.Header.Get("Content-Type"))
		}

		// Verify query parameters
		if r.URL.Query().Get("first") != "20" {
			t.Errorf("Expected 'first' query parameter '20', got '%s'", r.URL.Query().Get("first"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(testData)
	}))
	defer server.Close()

	// Create client with mock server URL
	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	result, err := client.GetCategories(ctx, 20, "top")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}

	if len(result.Data) != 3 {
		t.Errorf("Expected 3 categories, got %d", len(result.Data))
	}

	// Verify first category data
	firstCategory := result.Data[0]
	if firstCategory.ID != "509658" {
		t.Errorf("Expected category ID '509658', got '%s'", firstCategory.ID)
	}
	if firstCategory.Name != "Just Chatting" {
		t.Errorf("Expected category name 'Just Chatting', got '%s'", firstCategory.Name)
	}
	if firstCategory.IGDBId != "123456" {
		t.Errorf("Expected IGDB ID '123456', got '%s'", firstCategory.IGDBId)
	}
	expectedBoxArt := "https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-{width}x{height}.jpg"
	if firstCategory.BoxArtURL != expectedBoxArt {
		t.Errorf("Expected box art URL '%s', got '%s'", expectedBoxArt, firstCategory.BoxArtURL)
	}
}

func TestGetCategories_SortParameter(t *testing.T) {
	testData, err := os.ReadFile("testdata/sample_categories_response.json")
	if err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	tests := []struct {
		name      string
		sortBy    string
		shouldErr bool
	}{
		{
			name:      "Valid sort parameter 'top'",
			sortBy:    "top",
			shouldErr: false,
		},
		{
			name:      "Empty sort parameter",
			sortBy:    "",
			shouldErr: false,
		},
		{
			name:      "Invalid sort parameter",
			sortBy:    "invalid",
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write(testData)
			}))
			defer server.Close()

			client := createTestClient("test_token", false)
			client.httpClient = &http.Client{
				Transport: &mockTransport{
					server: server,
				},
				Timeout: HTTPTimeout * time.Second,
			}

			ctx := context.Background()
			result, err := client.GetCategories(ctx, 20, tt.sortBy)

			if tt.shouldErr {
				if err == nil {
					t.Errorf("Expected error for sort parameter '%s', got nil", tt.sortBy)
				}
				if result != nil {
					t.Errorf("Expected nil result on error, got: %v", result)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error for sort parameter '%s', got: %v", tt.sortBy, err)
				}
				if result == nil {
					t.Error("Expected result, got nil")
				}
			}
		})
	}
}

func TestGetCategories_OAuthError(t *testing.T) {
	client := createTestClient("", true) // OAuth manager will return error

	ctx := context.Background()
	result, err := client.GetCategories(ctx, 20, "top")

	if err == nil {
		t.Fatal("Expected error due to OAuth failure, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on error, got: %v", result)
	}

	expectedErrMsg := "failed to get OAuth token"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}

func TestGetCategories_HTTPError(t *testing.T) {
	// Create mock server that returns HTTP error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Unauthorized","status":401,"message":"Invalid OAuth token"}`))
	}))
	defer server.Close()

	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	result, err := client.GetCategories(ctx, 20, "top")

	if err == nil {
		t.Fatal("Expected error due to HTTP 401, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on error, got: %v", result)
	}

	expectedErrMsg := "Twitch API returned error status 401"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}

func TestGetCategories_InvalidJSON(t *testing.T) {
	// Create mock server that returns invalid JSON
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"invalid": json}`)) // Invalid JSON
	}))
	defer server.Close()

	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	result, err := client.GetCategories(ctx, 20, "top")

	if err == nil {
		t.Fatal("Expected error due to invalid JSON, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on error, got: %v", result)
	}

	expectedErrMsg := "failed to parse JSON response"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}

func TestGetCategories_LimitValidation(t *testing.T) {
	testData, err := os.ReadFile("testdata/sample_categories_response.json")
	if err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	tests := []struct {
		name          string
		inputLimit    int
		expectedLimit string
	}{
		{
			name:          "Zero limit uses default",
			inputLimit:    0,
			expectedLimit: "20", // DefaultCategoryLimit
		},
		{
			name:          "Negative limit uses default",
			inputLimit:    -5,
			expectedLimit: "20", // DefaultCategoryLimit
		},
		{
			name:          "Valid limit is preserved",
			inputLimit:    50,
			expectedLimit: "50",
		},
		{
			name:          "Limit above max is capped",
			inputLimit:    200,
			expectedLimit: "100", // MaxCategoryLimit
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				actualLimit := r.URL.Query().Get("first")
				if actualLimit != tt.expectedLimit {
					t.Errorf("Expected limit '%s', got '%s'", tt.expectedLimit, actualLimit)
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write(testData)
			}))
			defer server.Close()

			client := createTestClient("test_token", false)
			client.httpClient = &http.Client{
				Transport: &mockTransport{
					server: server,
				},
				Timeout: HTTPTimeout * time.Second,
			}

			ctx := context.Background()
			_, err := client.GetCategories(ctx, tt.inputLimit, "top")

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestGetCategories_NetworkError(t *testing.T) {
	client := createTestClient("test_token", false)

	// Use an invalid URL to simulate network error
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: &httptest.Server{
				URL: "http://invalid-host-that-does-not-exist:9999",
			},
		},
		Timeout: 1 * time.Second, // Short timeout for faster test
	}

	ctx := context.Background()
	result, err := client.GetCategories(ctx, 20, "top")

	if err == nil {
		t.Fatal("Expected network error, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on network error, got: %v", result)
	}

	expectedErrMsg := "failed to make request to Twitch API"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}
func TestGetStreams_Success(t *testing.T) {
	// Load test data
	testData, err := os.ReadFile("testdata/sample_streams_response.json")
	if err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request headers
		if r.Header.Get("Authorization") != "Bearer test_token" {
			t.Errorf("Expected Authorization header 'Bearer test_token', got '%s'", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Client-Id") != "test_client_id" {
			t.Errorf("Expected Client-Id header 'test_client_id', got '%s'", r.Header.Get("Client-Id"))
		}

		// Verify query parameters
		if r.URL.Query().Get("first") != "10" {
			t.Errorf("Expected 'first' query parameter '10', got '%s'", r.URL.Query().Get("first"))
		}
		if r.URL.Query().Get("game_id") != "12345" {
			t.Errorf("Expected 'game_id' query parameter '12345', got '%s'", r.URL.Query().Get("game_id"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(testData)
	}))
	defer server.Close()

	// Create client with mock server URL
	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	params := StreamsQueryParams{
		Limit:  10,
		GameID: "12345",
		Sort:   "viewers",
	}
	result, err := client.GetStreams(ctx, params)

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}

	if len(result.Data) != 2 {
		t.Errorf("Expected 2 streams, got %d", len(result.Data))
	}
}

func TestGetStreams_ParameterValidation(t *testing.T) {
	client := createTestClient("test_token", false)

	ctx := context.Background()

	// Test invalid limit
	params := StreamsQueryParams{
		Limit: 200, // Above max limit
	}
	result, err := client.GetStreams(ctx, params)

	if err == nil {
		t.Fatal("Expected error for invalid limit, got nil")
	}

	if result != nil {
		t.Errorf("Expected nil result on validation error, got: %v", result)
	}

	expectedErrMsg := "invalid parameters"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}

func TestGetStreams_RecentSorting(t *testing.T) {
	// Create test data with different timestamps for sorting
	testDataWithTimestamps := `{
		"data": [
			{
				"id": "1",
				"user_login": "user1",
				"started_at": "2023-01-01T10:00:00Z",
				"viewer_count": 100
			},
			{
				"id": "2", 
				"user_login": "user2",
				"started_at": "2023-01-01T12:00:00Z",
				"viewer_count": 50
			},
			{
				"id": "3",
				"user_login": "user3", 
				"started_at": "2023-01-01T11:00:00Z",
				"viewer_count": 75
			}
		]
	}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(testDataWithTimestamps))
	}))
	defer server.Close()

	client := createTestClient("test_token", false)
	client.httpClient = &http.Client{
		Transport: &mockTransport{
			server: server,
		},
		Timeout: HTTPTimeout * time.Second,
	}

	ctx := context.Background()
	params := StreamsQueryParams{
		Limit: 10,
		Sort:  "recent",
	}
	result, err := client.GetStreams(ctx, params)

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected result, got nil")
	}

	if len(result.Data) != 3 {
		t.Errorf("Expected 3 streams, got %d", len(result.Data))
	}

	// Verify sorting by most recent first (user2 should be first with 12:00:00Z)
	if result.Data[0].ID != "2" {
		t.Errorf("Expected first stream ID '2' (most recent), got '%s'", result.Data[0].ID)
	}
	if result.Data[1].ID != "3" {
		t.Errorf("Expected second stream ID '3', got '%s'", result.Data[1].ID)
	}
	if result.Data[2].ID != "1" {
		t.Errorf("Expected third stream ID '1' (oldest), got '%s'", result.Data[2].ID)
	}
}
