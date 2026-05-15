import { Router } from 'express';
import { login, logout, me, refresh, register } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createRateLimiter } from '../utils/rateLimiter';

const ONE_MINUTE = 60 * 1000;

const registerLimiter = createRateLimiter({
  windowMs: ONE_MINUTE,
  max: 5,
  message: 'Too many registration attempts. Try again in a minute.',
});

const loginLimiter = createRateLimiter({
  windowMs: ONE_MINUTE,
  max: 10,
  message: 'Too many login attempts. Try again in a minute.',
});

const refreshLimiter = createRateLimiter({
  windowMs: ONE_MINUTE,
  max: 30,
  message: 'Too many refresh attempts. Try again in a minute.',
});

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

export default router;
