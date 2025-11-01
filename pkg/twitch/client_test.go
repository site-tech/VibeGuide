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

	expectedErrMsg := "twitch API returned error status 401"
	if len(err.Error()) < len(expectedErrMsg) || err.Error()[:len(expectedErrMsg)] != expectedErrMsg {
		t.Errorf("Expected error message to start with '%s', got: %s", expectedErrMsg, err.Error())
	}
}
