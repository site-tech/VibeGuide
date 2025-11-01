package main

import (
	"context"
	"fmt"
	_ "image/gif"
	_ "image/png"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httplog/v2"
	"github.com/go-chi/render"
	"github.com/site-tech/VibeGuide/pkg/logger"
	"github.com/site-tech/VibeGuide/pkg/mytypes"
	"github.com/site-tech/VibeGuide/pkg/twitch"
	"github.com/supabase-community/supabase-go"
	"gorm.io/gorm"

	zlog "github.com/rs/zerolog/log"
	_ "github.com/swaggo/swag"
)

var DB *gorm.DB

var SBClient *supabase.Client

type apiVersionCtx string

var apivctx apiVersionCtx = "api.version"

var Config *VibeConfig

type VibeConfig struct {
	// Basic Fields
	Port   string
	LogLvl string

	// Twitch API Credentials
	TwitchClientID     string
	TwitchClientSecret string
	// Database Fields
	DbURL     string
	DbName    string
	DbPort    string
	DbUser    string
	DbPass    string
	DbMigrate bool
	// Supabase Vars
	SupabaseApiUrl string
	SupabaseApiKey string
}

func loadConfig() (*VibeConfig, error) {
	newConfig := VibeConfig{}
	var err error

	// Load vars from env
	newConfig.Port = os.Getenv("PORT")
	newConfig.LogLvl = os.Getenv("LOGLVL")

	// Load Twitch API credentials
	newConfig.TwitchClientID = os.Getenv("TWITCH_CLIENT_ID")
	newConfig.TwitchClientSecret = os.Getenv("TWITCH_CLIENT_SECRET")

	// Validate required Twitch credentials
	if newConfig.TwitchClientID == "" {
		return nil, fmt.Errorf("TWITCH_CLIENT_ID environment variable is required")
	}
	if newConfig.TwitchClientSecret == "" {
		return nil, fmt.Errorf("TWITCH_CLIENT_SECRET environment variable is required")
	}

	Config = &newConfig
	newConfig.DbURL = getEnv("DBURL", "localhost")
	newConfig.DbName = getEnv("DBNAME", "")
	newConfig.DbPort = getEnv("DBPORT", "5432")
	newConfig.DbUser = getEnv("DBUSER", "")
	newConfig.DbPass = os.Getenv("DBPASS")
	newConfig.SupabaseApiUrl = getEnv("SB_API_URL", "http://host.docker.internal:54321")
	newConfig.SupabaseApiKey = getEnv("SB_API_KEY", "")

	newConfig.DbMigrate, err = getEnvAsBool("DBMIGRATE", false)
	if err != nil {
		return nil, err
	}

	Config = &newConfig
	return &newConfig, nil
}

func main() {
	if err := run(); err != nil {
		zlog.Fatal().Err(err)
	}
}

func run() (err error) {
	zlog.Info().Msg("VibeGuide Backend Service")

	zlog.Info().Msg("loading config...")
	config, err := loadConfig()
	if err != nil {
		zlog.Error().Msg(fmt.Sprintf("getConfig err: %v\n", err))
		return
	}
	zlog.Info().Msg("config loaded")

	// Handle SIGINT (CTRL+C) gracefully
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	zlog.Info().Msg(fmt.Sprintf("vibe config: %+v\n", config))

	// Initialize Twitch client
	zlog.Info().Msg("initializing Twitch client...")
	twitchClient := twitch.NewClient(config.TwitchClientID, config.TwitchClientSecret)
	if twitchClient == nil {
		return fmt.Errorf("failed to initialize Twitch client: client is nil")
	}

	// Test client initialization by attempting to get a token
	testCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = twitchClient.GetTopStreams(testCtx, 1)
	if err != nil {
		zlog.Error().Err(err).Msg("Twitch client initialization test failed")
		return fmt.Errorf("failed to initialize Twitch client: %w", err)
	}

	zlog.Info().Msg("Twitch client initialized and tested successfully")
	zlog.Info().Msg("connecting to database...")
	db, err := Connect(DBCredentials{
		Url:  config.DbURL,
		Port: config.DbPort,
		User: config.DbUser,
		Pass: config.DbPass,
		Name: config.DbName,
	})
	if err != nil {
		zlog.Error().Msg(fmt.Sprintf("database connection err: %v\n", err))
		return
	}
	DB = db
	zlog.Info().Msg("connected to database")

	if config.DbMigrate {
		zlog.Info().Msg("migrating database...")
		err = MigrateDatabase(DB)
		if err != nil {
			zlog.Error().Msg(fmt.Sprintf("database migration err: %v\n", err))
			return
		}
		zlog.Info().Msg("db migrated")
	}

	zlog.Info().Msg("creating supabase client...")
	// Setup Supabase Auth Client
	supabaseClient, err := supabase.NewClient(config.SupabaseApiUrl, config.SupabaseApiKey,
		&supabase.ClientOptions{})

	if err != nil {
		zlog.Error().Msg(fmt.Sprintf("supabase client init error: %v\n", err))
		return
	}
	SBClient = supabaseClient
	zlog.Info().Msg("supabase client created.")

	zlog.Info().Msg("building router...")
	router := routes(twitchClient)
	zlog.Info().Msg("router built")

	// Build HTTP server
	zlog.Info().Msg("starting service...")
	zlog.Info().Msg(fmt.Sprintf("micro-service running on PORT: %v", config.Port))

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", config.Port),
		BaseContext:  func(_ net.Listener) context.Context { return ctx },
		ReadTimeout:  5 * time.Second,  // Increased slightly for larger images
		WriteTimeout: 20 * time.Second, // Increased slightly for larger images
		Handler:      router,
	}
	srvErr := make(chan error, 1)
	go func() {
		srvErr <- srv.ListenAndServe()
	}()

	// Wait for interruption
	select {
	case err = <-srvErr:
		// Error when starting HTTP server
		return
	case <-ctx.Done():
		// Wait for first CTRL+C
		// Stop receiving signal notifications as soon as possible
		stop()
	}

	// When shutdown is called, ListenAndServe immediately returns ErrServerClosed

	err = srv.Shutdown(context.Background())
	return
}

// ============= ROUTER =============

func routes(twitchClient twitch.Client) *chi.Mux {
	r := chi.NewRouter()

	r.Use(render.SetContentType(render.ContentTypeJSON),
		middleware.RedirectSlashes,
		middleware.RequestID,
		middleware.Heartbeat("/v1/heartbeat"),
		httplog.RequestLogger(logger.NewRouterLogger()),
		render.SetContentType(render.ContentTypeJSON),
		middleware.Recoverer,
		corsMiddleware(),
	)

	r.Use(middleware.Timeout(45 * time.Second)) // Increased for potentially slower HEIC decoding

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		logger.WriteErrCheck(w.Write([]byte("online")))
	})

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		logger.WriteErrCheck(w.Write([]byte("pong")))
	})

	r.Route("/v1", func(r chi.Router) {
		r.Use(apiVersionContext("v1"))
		r.Use(twitchClientContext(twitchClient))
		r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			render.JSON(w, r, map[string]string{"message": "getTest"})
		})
		// CRUD API Routes
		r.Mount("/vibe", vibeRouter())
		// Auth Routes
		r.Mount("/auth", authRouter())
		// Twitch API Routes
		r.Mount("/twitch", twitchRouter(twitchClient))
	})

	return r
}

func vibeRouter() http.Handler {
	r := chi.NewRouter()
	r.Post("/", demoHandler)

	return r
}

func authRouter() http.Handler {
	r := chi.NewRouter()
	// Email/Password Auth
	r.Post("/signup", signupUser)
	r.Post("/login", loginUser)
	r.Post("/logout", logoutUser)
	r.Get("/user", getUserAuth)

	// Twitch OAuth
	r.Get("/twitch/url", getTwitchAuthURL)
	r.Post("/twitch/callback", twitchCallback)
	r.Get("/twitch/validate", validateTwitchToken)

	return r
}

func demoHandler(w http.ResponseWriter, r *http.Request) {
	tId := middleware.GetReqID(r.Context())
	apiVersion := r.Context().Value(apivctx).(string)
	zlog.Info().Msgf("(%s) demoHandler: %v", tId, apiVersion)

	zlog.Info().Msgf("(%s) demoHandler done", tId)
}

// ======== ROUTER HELPERS ========

func handleErr(w http.ResponseWriter, r *http.Request, err error, code int) {
	ctx := r.Context()
	tId := middleware.GetReqID(ctx)
	apiVersion := ctx.Value(apivctx).(string)
	resp := mytypes.APIHandlerResp{TransactionId: tId, ApiVersion: apiVersion}
	if err != nil {
		w.WriteHeader(code)
		resp.Data = err.Error() // Best practice: Send the error string instead of the raw error object.
		zlog.Error().
			Err(err).
			Int("status_code", code).
			Str("transaction_id", tId).
			Str("api_version", apiVersion).
			Str("request_path", r.URL.Path).
			Str("request_method", r.Method).
			Msg("API Error")
		render.JSON(w, r, resp)
	}
}

func apiVersionContext(version string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r = r.WithContext(context.WithValue(r.Context(), apivctx, version))
			next.ServeHTTP(w, r)
		})
	}
}

func twitchClientContext(twitchClient twitch.Client) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r = r.WithContext(context.WithValue(r.Context(), "twitchClient", twitchClient))
			next.ServeHTTP(w, r)
		})
	}
}

func corsMiddleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Allow requests from frontend
			origin := r.Header.Get("Origin")
			if origin == "" {
				origin = "*"
			}

			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "300")

			// Handle preflight requests
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// --- Helper Functions for Robust Env Var Parsing ---

// getEnv retrieves an environment variable or returns a fallback value.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// getEnvAsUint retrieves and parses an environment variable as a uint or returns a fallback.
func getEnvAsUint(key string, fallback uint) (uint, error) {
	strVal := os.Getenv(key)
	if strVal == "" {
		return fallback, nil
	}
	val, err := strconv.ParseUint(strVal, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("could not parse env var %s: %w", key, err)
	}
	return uint(val), nil
}

// getEnvAsBool retrieves and parses an environment variable as a bool or returns a fallback.
func getEnvAsBool(key string, fallback bool) (bool, error) {
	strVal := os.Getenv(key)
	if strVal == "" {
		return fallback, nil
	}
	val, err := strconv.ParseBool(strVal)
	if err != nil {
		return false, fmt.Errorf("could not parse env var %s: %w", key, err)
	}
	return val, nil
}
