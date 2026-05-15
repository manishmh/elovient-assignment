import { Router } from 'express';
import {
  getStats,
  getSuspicious,
  logAction,
  replayCheck,
} from '../controllers/activity.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, logAction);
router.post('/replay-check', requireAuth, replayCheck);
router.get('/stats', requireAuth, getStats);
router.get('/suspicious', requireAuth, getSuspicious);

export default router;
