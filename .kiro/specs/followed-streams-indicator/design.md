# Design Document

## Overview

This feature adds heart indicators next to stream names for channels that the authenticated user follows. The implementation involves creating a new backend endpoint to fetch follow relationships and updating the frontend to display heart icons based on this data.

## Architecture

The solution follows the existing application architecture:

### Backend Components
- **New Follows Endpoint**: `/v1/twitch/follows` - Returns list of channels the authenticated user follows
- **Twitch Client Extension**: Add `GetUserFollows` method to retrieve follow data from Twitch API
- **Authentication Integration**: Use existing Supabase OAuth tokens to authenticate with Twitch API

### Frontend Components
- **Stream Display Enhancement**: Modify existing stream rendering in `App.jsx` to show heart indicators
- **Follow Status Service**: Frontend utility to fetch and cache follow data
- **Heart Icon Component**: Visual indicator displayed next to followed stream names

## Components and Interfaces

### Backend API Endpoint

**Endpoint**: `GET /v1/twitch/follows`

**Headers**:
- `Authorization: Bearer <supabase_jwt_token>`

**Response**:
```json
{
  "transaction_id": "uuid",
  "api_version": "v1",
  "data": {
    "follows": [
      {
        "broadcaster_id": "123456",
        "broadcaster_login": "streamer_name",
        "broadcaster_name": "Streamer Display Name",
        "followed_at": "2023-01-01T00:00:00Z"
      }
    ],
    "total": 150,
    "cached_at": "2023-01-01T00:00:00Z"
  }
}
```

### Twitch Client Interface Extension

```go
type Client interface {
    // Existing methods...
    GetUserFollows(ctx context.Context, userID string, userToken string) (*FollowsResponse, error)
}

type FollowsResponse struct {
    Data []Follow `json:"data"`
    Total int `json:"total"`
    Pagination Pagination `json:"pagination"`
}

type Follow struct {
    BroadcasterID    string `json:"broadcaster_id"`
    BroadcasterLogin string `json:"broadcaster_login"`
    BroadcasterName  string `json:"broadcaster_name"`
    FollowedAt       string `json:"followed_at"`
}
```

### Frontend API Integration

```javascript
// New function in src/lib/api.js
export async function getUserFollows() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  
  const response = await fetch(`${API_BASE_URL}/v1/twitch/follows`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch follows: ${response.status}`)
  }
  
  const data = await response.json()
  return data.data.follows
}
```

## Data Models

### Follow Data Structure
```go
type Follow struct {
    BroadcasterID    string `json:"broadcaster_id"`
    BroadcasterLogin string `json:"broadcaster_login"`
    BroadcasterName  string `json:"broadcaster_name"`
    FollowedAt       string `json:"followed_at"`
}
```

### Frontend Follow State
```javascript
const [followedChannels, setFollowedChannels] = useState(new Set()) // Set of broadcaster_login values
const [followsLoading, setFollowsLoading] = useState(false)
const [followsError, setFollowsError] = useState(null)
```

## Error Handling

### Backend Error Scenarios
1. **Unauthenticated User**: Return 401 with clear error message
2. **Invalid Supabase Token**: Return 401 with token validation error
3. **Missing Twitch Token**: Return 403 with OAuth scope error
4. **Twitch API Rate Limiting**: Return 429 with retry-after header
5. **Twitch API Errors**: Return 502 with upstream error details

### Frontend Error Handling
1. **Authentication Errors**: Silently fail - no hearts shown for unauthenticated users
2. **Network Errors**: Log error, use cached data if available, show no hearts on failure
3. **API Errors**: Display error state only in console, graceful degradation

## Testing Strategy

### Backend Testing
1. **Unit Tests**: Test `GetUserFollows` method with mock Twitch API responses
2. **Integration Tests**: Test follows endpoint with valid/invalid authentication
3. **Error Handling Tests**: Verify proper error responses for various failure scenarios

### Frontend Testing
1. **Component Tests**: Verify heart icons appear/disappear based on follow status
2. **API Integration Tests**: Test follow data fetching and caching behavior
3. **Authentication Tests**: Verify behavior with authenticated/unauthenticated users

## Implementation Details

### Authentication Flow
1. Frontend checks if user is authenticated via Supabase
2. If authenticated, extract Twitch access token from Supabase session
3. Backend validates Supabase JWT and extracts Twitch token
4. Use Twitch token to call Twitch API on behalf of user

### Caching Strategy
- **Backend**: Cache follow data for 5 minutes using in-memory cache with user ID as key
- **Frontend**: Cache follow data in component state, refresh on user login/logout
- **Cache Invalidation**: Clear cache when user logs out or token expires

### Performance Considerations
- **Batch Processing**: Fetch all follows in single API call, not per-stream
- **Lazy Loading**: Load follow data after streams are displayed
- **Progressive Enhancement**: Show streams immediately, add hearts as follow data loads
- **Debouncing**: Prevent multiple simultaneous follow data requests

### UI/UX Design
- **Heart Icon**: Use ❤️ emoji or custom SVG icon positioned after stream name
- **Styling**: Match existing text styling with slight color variation for hearts
- **Positioning**: Right-aligned within stream name cell, with proper spacing
- **Responsive**: Scale heart size with existing font size calculations
- **Accessibility**: Include aria-label for screen readers

### Security Considerations
- **Token Validation**: Verify Supabase JWT signature and expiration
- **Scope Verification**: Ensure Twitch token has required `user:read:follows` scope
- **Rate Limiting**: Implement per-user rate limiting for follows endpoint
- **Data Privacy**: Only return follow data for authenticated user, no cross-user access