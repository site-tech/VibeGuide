# Implementation Plan

- [x] 1. Extend Twitch client with follows functionality
  - Add `GetUserFollows` method to Twitch client interface and implementation
  - Add Follow and FollowsResponse types to support user follows data
  - Implement Twitch API call to `/helix/channels/followed` endpoint using user token
  - _Requirements: 1.4, 2.1_

- [x] 2. Create follows API endpoint
  - Add `/v1/twitch/follows` GET endpoint to twitch handlers
  - Implement authentication middleware to extract Supabase JWT and Twitch token
  - Add caching mechanism for follow data with 5-minute expiration
  - Implement proper error handling for authentication and API failures
  - _Requirements: 1.4, 2.1, 2.2, 2.4, 2.5, 3.5_

- [x] 3. Add frontend follow data fetching
  - Create `getUserFollows` function in `src/lib/api.js` to call follows endpoint
  - Add follow state management to App.jsx (followedChannels Set, loading, error states)
  - Implement follow data fetching on user authentication
  - Add error handling and graceful degradation for follow data failures
  - _Requirements: 1.1, 1.3, 2.3, 3.1, 3.4, 3.5_

- [x] 4. Implement heart indicator UI
  - Add heart icon display logic to stream name rendering in App.jsx
  - Style heart icons to match existing text styling and positioning
  - Implement progressive loading of hearts as follow data becomes available
  - Ensure hearts only show for authenticated users with valid follow data
  - _Requirements: 1.1, 1.2, 1.5, 3.2_

- [ ]* 5. Add comprehensive testing
  - Write unit tests for GetUserFollows Twitch client method
  - Create integration tests for follows API endpoint with authentication scenarios
  - Add frontend tests for heart icon display logic and follow data handling
  - Test error scenarios and graceful degradation behavior
  - _Requirements: 1.3, 2.5, 3.5_