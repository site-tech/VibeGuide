package main

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	zlog "github.com/rs/zerolog/log"
	"github.com/site-tech/VibeGuide/pkg/mytypes"
	"github.com/site-tech/VibeGuide/pkg/twitch"
	"github.com/supabase-community/gotrue-go/types"
)

// Auth Methods =============================================================

func signupUser(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) signupUser: %v", tId, apiVersion)

	var emailPass = struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}{}
	// pull email & password from post body
	err := render.DecodeJSON(r.Body, &emailPass)
	if err != nil {
		zlog.Error().Msgf("(%s) signupUser: body decode error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}
	// use supabase client to sign up
	signupResp, err := SBClient.Auth.Signup(types.SignupRequest{
		Email:    emailPass.Email,
		Password: emailPass.Password,
	})
	if err != nil {
		zlog.Error().Msgf("(%s) signupUser: signup user error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}
	resp.Data = signupResp

	zlog.Info().Msgf("(%s) signupUser done.", tId)
	render.JSON(w, r, resp)
}

func loginUser(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) loginUser: %v", tId, apiVersion)

	var emailPass = struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}{}
	// pull email & password from post body
	err := render.DecodeJSON(r.Body, &emailPass)
	if err != nil {
		zlog.Error().Msgf("(%s) loginUser: body decode error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}
	// use supabase client to login
	session, err := SBClient.SignInWithEmailPassword(emailPass.Email, emailPass.Password)
	if err != nil {
		zlog.Error().Msgf("(%s) loginUser: login user error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}
	resp.Data = session

	zlog.Info().Msgf("(%s) loginUser done.", tId)
	render.JSON(w, r, resp)
}

func logoutUser(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) logoutUser: %v", tId, apiVersion)

	// Extract access token from Authorization header
	accessToken, err := extractBearerToken(r)
	if err != nil {
		zlog.Error().Msgf("(%s) logoutUser: token extraction error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusUnauthorized)
		return
	}

	// Create auth client with token and logout
	authClient := SBClient.Auth.WithToken(accessToken)
	err = authClient.Logout()
	if err != nil {
		zlog.Error().Msgf("(%s) logoutUser: logout error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}

	zlog.Info().Msgf("(%s) logoutUser done.", tId)
	render.JSON(w, r, resp)
}

func getUserAuth(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) getUserAuth: %v", tId, apiVersion)

	// Extract access token from Authorization header
	accessToken, err := extractBearerToken(r)
	if err != nil {
		zlog.Error().Msgf("(%s) getUserAuth: token extraction error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusUnauthorized)
		return
	}

	// Create auth client with token and get user
	authClient := SBClient.Auth.WithToken(accessToken)
	user, err := authClient.GetUser()
	if err != nil {
		zlog.Error().Msgf("(%s) getUserAuth: get user error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusUnauthorized)
		return
	}
	resp.Data = user

	zlog.Info().Msgf("(%s) getUserAuth done.", tId)
	render.JSON(w, r, resp)
}

// extractBearerToken extracts the bearer token from the Authorization header
func extractBearerToken(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", http.ErrNotSupported
	}

	// Expected format: "Bearer <token>"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", http.ErrNotSupported
	}

	return parts[1], nil
}

// Twitch OAuth Methods =============================================================

func getTwitchAuthURL(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) getTwitchAuthURL: %v", tId, apiVersion)

	// Get redirect URI and state from query params
	redirectURI := r.URL.Query().Get("redirect_uri")
	state := r.URL.Query().Get("state")

	if redirectURI == "" {
		zlog.Error().Msgf("(%s) getTwitchAuthURL: missing redirect_uri parameter", tId)
		handleErr(w, r, http.ErrNotSupported, http.StatusBadRequest)
		return
	}

	if state == "" {
		zlog.Error().Msgf("(%s) getTwitchAuthURL: missing state parameter", tId)
		handleErr(w, r, http.ErrNotSupported, http.StatusBadRequest)
		return
	}

	// Define scopes for Twitch OAuth
	scopes := []string{"user:read:email"}

	// Get Twitch client from context (passed via router)
	twitchClient := r.Context().Value("twitchClient").(twitch.Client)
	authURL := twitchClient.GetAuthorizationURL(redirectURI, state, scopes)

	resp.Data = map[string]string{
		"auth_url": authURL,
	}

	zlog.Info().Msgf("(%s) getTwitchAuthURL done.", tId)
	render.JSON(w, r, resp)
}

func twitchCallback(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) twitchCallback: %v", tId, apiVersion)

	// Get code and state from query params
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	redirectURI := r.URL.Query().Get("redirect_uri")

	if code == "" {
		zlog.Error().Msgf("(%s) twitchCallback: missing code parameter", tId)
		handleErr(w, r, http.ErrNotSupported, http.StatusBadRequest)
		return
	}

	if redirectURI == "" {
		zlog.Error().Msgf("(%s) twitchCallback: missing redirect_uri parameter", tId)
		handleErr(w, r, http.ErrNotSupported, http.StatusBadRequest)
		return
	}

	// Get Twitch client from context
	twitchClient := r.Context().Value("twitchClient").(twitch.Client)

	// Exchange code for token
	userToken, err := twitchClient.ExchangeCodeForToken(r.Context(), code, redirectURI)
	if err != nil {
		zlog.Error().Msgf("(%s) twitchCallback: token exchange error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}

	// Get user info
	user, err := twitchClient.GetUserInfo(r.Context(), userToken.AccessToken)
	if err != nil {
		zlog.Error().Msgf("(%s) twitchCallback: get user info error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusBadRequest)
		return
	}

	// Create or update user in Supabase using Twitch ID
	// Note: You may want to link this with Supabase auth or store in your database
	resp.Data = map[string]interface{}{
		"access_token":  userToken.AccessToken,
		"refresh_token": userToken.RefreshToken,
		"expires_in":    userToken.ExpiresIn,
		"token_type":    userToken.TokenType,
		"scope":         userToken.Scope,
		"state":         state,
		"user": map[string]interface{}{
			"id":                user.ID,
			"login":             user.Login,
			"display_name":      user.DisplayName,
			"email":             user.Email,
			"profile_image_url": user.ProfileImageURL,
		},
	}

	zlog.Info().Msgf("(%s) twitchCallback done.", tId)
	render.JSON(w, r, resp)
}

func validateTwitchToken(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	zlog.Info().Msgf("(%s) validateTwitchToken: %v", tId, apiVersion)

	// Extract access token from Authorization header
	accessToken, err := extractBearerToken(r)
	if err != nil {
		zlog.Error().Msgf("(%s) validateTwitchToken: token extraction error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusUnauthorized)
		return
	}

	// Get Twitch client from context
	twitchClient := r.Context().Value("twitchClient").(twitch.Client)

	// Validate token
	validation, err := twitchClient.ValidateToken(r.Context(), accessToken)
	if err != nil {
		zlog.Error().Msgf("(%s) validateTwitchToken: validation error: %s", tId, err.Error())
		handleErr(w, r, err, http.StatusUnauthorized)
		return
	}

	resp.Data = validation

	zlog.Info().Msgf("(%s) validateTwitchToken done.", tId)
	render.JSON(w, r, resp)
}
