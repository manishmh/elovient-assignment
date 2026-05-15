import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import activityRoutes from './routes/activity.routes';
import { notFound, errorHandler } from './middleware/error.middleware';

const app: Application = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

// todo: Create a middleware to add timestamp to all requests response. maybe check first if required. 