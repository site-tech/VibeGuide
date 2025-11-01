package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DBCredentials struct {
	Url  string
	Port string
	User string
	Pass string
	Name string
}

func Connect(dbCred DBCredentials) (*gorm.DB, error) {
	url := dbCred.Url
	if strings.Contains(url, ":") {
		url = strings.Split(url, ":")[0]
	}
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		url, dbCred.User, dbCred.Pass, dbCred.Name, dbCred.Port)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			logger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  logger.Info,
				IgnoreRecordNotFoundError: false,
				ParameterizedQueries:      false,
				Colorful:                  false,
			},
		),
	})
	if err != nil {
		return nil, err
	}
	return db, nil
}

// Migration

func MigrateDatabase(db *gorm.DB) error {
	return db.AutoMigrate(&Role{}, &User{}, &Image{})
}

// Mock

func DbMock(t *testing.T) (*sql.DB, *gorm.DB, sqlmock.Sqlmock) {
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: false,
			ParameterizedQueries:      false,
			Colorful:                  false,
		},
	)
	sqldb, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	dialector := postgres.New(postgres.Config{
		Conn:       sqldb,
		DriverName: "postgres",
	})
	gormdb, _ := gorm.Open(dialector, &gorm.Config{Logger: newLogger})

	if err != nil {
		t.Fatal(err)
	}
	return sqldb, gormdb, mock
}

// Tables

type Role struct {
	// Id, created_at, updated_at, deleted_at
	gorm.Model
	Name        string `gorm:"uniqueIndex"`
	Description string
	// Role has many users
	Users []User
}

type User struct {
	gorm.Model
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
	// User has one role
	RoleID uint
	// User has many images
	Images []Image
}

type Image struct {
	gorm.Model
	Data []byte
	// FK
	UserID uint
}
