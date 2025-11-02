# Design Document

## Overview

This design transforms the existing `/twitch/streams/top` endpoint into a more flexible `/twitch/streams` endpoint that supports comprehensive query parameters for filtering, sorting, and pagination. The new endpoint will maintain backward compatibility in terms of response structure while providing enhanced functionality through query parameters.

## Architecture

### Current State
- Endpoint: `GET /twitch/streams/top?count=N`
- Handler: `getTopStreamsHandler` in `cmd/vibeguide/twitch_handlers.go`
- Client method: `GetTopStreams(ctx, limit)` in `pkg/twitch/client.go`

### Target State
- Endpoint: `GET /twitch/streams?limit=N&game_id=X&sort=Y`
- Handler: `getStreamsHandler` (new, replaces `getTopStreamsHandler`)
- Client method: `GetStreams(ctx, params)` (new, replaces `GetTopStreams`)

## Components and Interfaces

### 1. Query Parameters Structure

```go
type StreamsQueryParams struct {
    Limit  int    `json:"limit"`   // Number of streams to return (1-100, default: 20)
    GameID string `json:"game_id"` // Filter by specific game/category ID
    Sort   string `json:"sort"`    // Sorting method: "viewers" (default), "recent"
}
```

### 2. Updated Client Interface

```go
type Client interface {
    GetStreams(ctx context.Context, params StreamsQueryParams) (*StreamsResponse, error)
    // Keep existing method for backward compatibility during transition
    GetTopStreams(ctx context.Context, limit int) (*StreamsResponse, error)
}
```

### 3. Parameter Validation

```go
type ParameterValidator struct{}

func (v *ParameterValidator) ValidateStreamsParams(params StreamsQueryParams) error {
    // Validate limit: 1-100
    // Validate game_id: numeric string if provided
    // Validate sort: "viewers" or "recent"
}
```

### 4. URL Builder

The client will construct Twitch API URLs based on the provided parameters:

```go
func buildStreamsURL(params StreamsQueryParams) string {
    url := TwitchAPIBaseURL + StreamsEndpoint
    queryParams := []string{}
    
    if params.Limit > 0 {
        queryParams = append(queryParams, fmt.Sprintf("first=%d", params.Limit))
    }
    
    if params.GameID != "" {
        queryParams = append(queryParams, fmt.Sprintf("game_id=%s", params.GameID))
    }
    
    // Twitch API doesn't support custom sorting, so we'll handle this client-side
    // or document the limitation
    
    if len(queryParams) > 0 {
        url += "?" + strings.Join(queryParams, "&")
    }
    
    return url
}
```

## Data Models

### Request Parameters
- `limit`: Integer (1-100, default: 20)
- `game_id`: String (Twitch game/category ID, optional)
- `sort`: String enum ("viewers", "recent", default: "viewers")

### Response Structure
The response structure remains unchanged to maintain compatibility:

```go
type StreamsResponse struct {
    Data []Stream `json:"data"`
}
```

### Error Response
Standard API error response format:

```go
type APIHandlerResp struct {
    TransactionId string      `json:"transaction_id"`
    ApiVersion    string      `json:"api_version"`
    Data          interface{} `json:"data"`
}
```

## Error Handling

### Parameter Validation Errors (400 Bad Request)
- Invalid limit value (not 1-100)
- Invalid game_id format (not numeric)
- Invalid sort value (not "viewers" or "recent")

### Upstream API Errors
- Maintain existing error mapping from `determineErrorStatusCode()`
- 401/403 from Twitch → 503 Service Unavailable
- 429 from Twitch → 429 Too Many Requests
- 5xx from Twitch → 502 Bad Gateway

### Empty Results
- Return 200 OK with empty data array when no streams match criteria

## Testing Strategy

### Unit Tests
- Parameter validation logic
- URL building with different parameter combinations
- Error handling for various invalid inputs
- Response parsing and mapping

### Integration Tests
- End-to-end API calls with various parameter combinations
- Error scenarios with invalid parameters
- Twitch API error response handling

### Backward Compatibility Tests
- Ensure existing `/twitch/streams/top` functionality works during transition
- Verify response format consistency

## Implementation Phases

### Phase 1: Core Implementation
1. Add `StreamsQueryParams` struct to `pkg/twitch/types.go`
2. Implement parameter validation functions
3. Create new `GetStreams` method in client
4. Add new `getStreamsHandler` in handlers

### Phase 2: Endpoint Migration
1. Add new route `GET /twitch/streams` 
2. Update router to use new handler
3. Maintain old endpoint for backward compatibility

### Phase 3: Cleanup (Future)
1. Remove old `/twitch/streams/top` endpoint
2. Remove deprecated `GetTopStreams` method
3. Update documentation

## Limitations and Considerations

### Twitch API Constraints
- Twitch API doesn't support custom sorting beyond default (by viewer count)
- The "recent" sort option may need to be implemented client-side by sorting by `started_at`
- Game filtering is supported natively by Twitch API

### Performance Considerations
- Client-side sorting for "recent" option may impact performance for large result sets
- Consider caching strategies for frequently requested game categories

### Rate Limiting
- Maintain existing rate limiting patterns
- No additional API calls required for basic functionality