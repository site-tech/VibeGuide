# Implementation Plan

- [x] 1. Add new data structures and validation
  - Add `StreamsQueryParams` struct to `pkg/twitch/types.go` with limit, game_id, and sort fields
  - Implement parameter validation functions for limit (1-100), game_id (numeric string), and sort ("viewers"/"recent")
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Implement enhanced client method
  - Create `GetStreams(ctx, params)` method in `pkg/twitch/client.go` that accepts StreamsQueryParams
  - Implement URL building logic to construct Twitch API URLs with query parameters
  - Add client-side sorting for "recent" option by sorting streams by started_at timestamp
  - _Requirements: 1.1, 1.4, 1.5_

- [ ] 3. Create new HTTP handler
  - Implement `getStreamsHandler` function in `cmd/vibeguide/twitch_handlers.go`
  - Add query parameter parsing and validation with proper error responses for invalid parameters
  - Integrate with new client method and maintain existing response structure
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.3_

- [ ] 4. Update routing and maintain backward compatibility
  - Add new route `GET /twitch/streams` to `twitchRouter` function in `cmd/vibeguide/twitch_handlers.go`
  - Keep existing `/twitch/streams/top` route for backward compatibility during transition
  - _Requirements: 3.1, 3.4_

- [ ]* 5. Add comprehensive tests
  - Write unit tests for parameter validation logic and URL building functions
  - Create integration tests for the new endpoint with various parameter combinations
  - Add tests for error scenarios and backward compatibility verification
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.5_