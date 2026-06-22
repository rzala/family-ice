// go-fiber-test-login.go
//
// Test-only login endpoint for Go + Fiber backend.
// Mints a JWT without requiring magic link / email verification.
//
// USAGE:
// 1. Copy this file into your Fiber app's handlers directory.
// 2. Call RegisterTestRoutes(app) in your main.go.
// 3. Run with APP_ENV=test to enable the endpoint.
// 4. NEVER expose in production.
//
// Example in main.go:
//
//   app := fiber.New()
//   handlers.RegisterTestRoutes(app)
//   // ... other routes
//   app.Listen(":3000")

package handlers

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// RegisterTestRoutes adds test-only routes. Guarded by APP_ENV=test.
func RegisterTestRoutes(app *fiber.App) {
	if os.Getenv("APP_ENV") != "test" {
		return
	}
	app.Post("/api/test/login", testLoginHandler)
}

func testLoginHandler(c *fiber.Ctx) error {
	type loginReq struct {
		Email string `json:"email"`
	}

	var body loginReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if body.Email == "" {
		body.Email = "test@example.com"
	}

	// Use your existing JWT secret. Fallback for test-only usage.
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "test-secret-do-not-use-in-prod"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   body.Email,
		"email": body.Email,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to sign token"})
	}

	return c.JSON(fiber.Map{
		"token": signed,
		"email": body.Email,
	})
}
