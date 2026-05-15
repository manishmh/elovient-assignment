import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { User } from '../models/User';
import { ActivityLog } from '../models/ActivityLog';

dotenv.config();

const actions = ['click', 'view', 'login', 'logout', 'custom'];

const randomAction = () => {
  return actions[Math.floor(Math.random() * actions.length)];
};

const randomIp = () => {
  return `192.168.1.${Math.floor(Math.random() * 255)}`;
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    console.log('Connected to MongoDB');

    const users = await User.find({
      email: {
        $in: [
          'test1@gmail.com',
          'test2@gmail.com',
          'test3@gmail.com',
          'test4@gmail.com',
          'test5@gmail.com',
        ],
      },
    });

    if (users.length === 0) {
      throw new Error('No users found');
    }

    await ActivityLog.deleteMany({});

    const logs = [];

    const now = Date.now();

    for (const user of users) {
      // Normal activity
      for (let i = 0; i < 40; i++) {
        logs.push({
          userId: user._id,
          action: randomAction(),
          ip: randomIp(),
          userAgent: 'Mozilla/5.0',
          meta: {
            page: '/dashboard',
          },
          createdAt: new Date(
            now - Math.floor(Math.random() * 10 * 60 * 1000)
          ),
          updatedAt: new Date(),
        });
      }
    }

    // Suspicious user #1 (high frequency)
    const suspiciousUser1 = users[0];

    for (let i = 0; i < 25; i++) {
      logs.push({
        userId: suspiciousUser1._id,
        action: 'click',
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        meta: {
          page: '/spam',
        },
        createdAt: new Date(
          now - Math.floor(Math.random() * 60 * 1000)
        ),
        updatedAt: new Date(),
      });
    }

    // Suspicious user #2 (multiple IPs)
    const suspiciousUser2 = users[1];

    const ips = [
      '11.0.0.1',
      '11.0.0.2',
      '11.0.0.3',
      '11.0.0.4',
    ];

    for (let i = 0; i < 20; i++) {
      logs.push({
        userId: suspiciousUser2._id,
        action: 'view',
        ip: ips[i % ips.length],
        userAgent: 'Mozilla/5.0',
        meta: {
          page: '/analytics',
        },
        createdAt: new Date(
          now - Math.floor(Math.random() * 5 * 60 * 1000)
        ),
        updatedAt: new Date(),
      });
    }

    await ActivityLog.insertMany(logs);

    console.log(`Inserted ${logs.length} activity logs`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seed();