package main

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	zlog "github.com/rs/zerolog/log"
	"github.com/site-tech/VibeGuide/pkg/mytypes"
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
