// express-test-login.ts
//
// Test-only login endpoint for Express / Fastify backend.
// Mints a JWT without requiring magic link / email verification.
//
// USAGE:
// 1. Copy this file into your routes directory.
// 2. Import and mount: app.use('/api/test', testLoginRouter);
// 3. Run with APP_ENV=test (or NODE_ENV=test) to enable the endpoint.
// 4. NEVER expose in production.
//
// Dependencies: npm install jsonwebtoken @types/jsonwebtoken

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Guard: only register in test environment
if (process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test') {
  router.post('/login', (req: Request, res: Response) => {
    const email = req.body?.email || 'test@example.com';

    const secret = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';

    const token = jwt.sign(
      {
        sub: email,
        email,
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: '1h' },
    );

    res.json({ token, email });
  });
}

export default router;
