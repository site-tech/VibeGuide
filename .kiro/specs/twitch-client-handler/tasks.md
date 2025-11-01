# Implementation Plan

- [x] 1. Set up Twitch package structure and core interfaces
  - Create `pkg/twitch/` directory structure
  - Define core interfaces and data models for Stream and StreamsResponse
  - Create package-level constants for API URLs and defaults
  - _Requirements: 1.1, 1.4_

- [ ] 2. Implement OAuth token management
  - [x] 2.1 Create OAuth manager with token acquisition
    - Implement `OAuthManager` struct with client credentials flow
    - Add method to request access token from Twitch OAuth endpoint
    - Include proper error handling for authentication failures
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.2 Add token storage and validation
    - Implement in-memory token storage
    - Add token expiration validation logic
    - _Requirements: 2.2_

- [ ] 3. Create Twitch API client
  - [x] 3.1 Implement core client structure
    - Create `Client` struct with HTTP client and OAuth manager
    - Add client initialization with credentials
    - _Requirements: 1.1, 1.4_
  
  - [x] 3.2 Implement GetTopStreams method
    - Add method to fetch top streams from Twitch API
    - Include proper request headers and authentication
    - Parse JSON response into Stream structs
    - Handle API errors and HTTP status codes
    - _Requirements: 1.1, 3.1, 3.3_

- [ ] 4. Extend configuration system
  - [x] 4.1 Add Twitch credentials to VibeConfig
    - Extend `VibeConfig` struct with `TwitchClientID` and `TwitchClientSecret` fields
    - Update `loadConfig()` function to load Twitch environment variables
    - Add validation for required Twitch credentials
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 5. Create HTTP handlers and routing
  - [x] 5.1 Implement Twitch HTTP handlers
    - Create `getTopStreamsHandler` function
    - Use existing `handleErr` pattern for error responses
    - Format responses using `mytypes.APIHandlerResp` structure
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 5.2 Add Twitch routes to main router
    - Create `twitchRouter()` function with `/streams/top` endpoint
    - Mount Twitch router under `/v1/twitch` path
    - Initialize Twitch client in main function
    - _Requirements: 3.1_

- [x] 6. Integration and error handling
  - [x] 6.1 Integrate Twitch client with main application
    - Initialize Twitch client in `main()` function using loaded config
    - Pass client instance to router setup
    - Add proper error handling for client initialization failures
    - _Requirements: 1.3, 2.3, 4.4_
  
  - [x] 6.2 Add comprehensive error handling
    - Implement proper HTTP status codes for different error scenarios
    - Add logging for OAuth and API failures
    - Ensure all errors include transaction ID and API version
    - _Requirements: 1.4, 2.3, 3.3_

- [x] 7. Add unit tests for core functionality
  - [x] 7.1 Create OAuth manager tests
    - Test token acquisition success and failure scenarios
    - Test token validation logic
    - _Requirements: 2.1, 2.3_
  
  - [-] 7.2 Create client tests
    - Test GetTopStreams method with mock responses
    - Test error handling for various API failure scenarios
    - Create test data files for sample Twitch API responses
    - _Requirements: 1.1, 3.3_
  
  - [ ] 7.3 Create handler tests
    - Test HTTP endpoint with successful responses
    - Test error scenarios and proper HTTP status codes
    - _Requirements: 3.1, 3.2, 3.3_