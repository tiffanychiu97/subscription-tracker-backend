import express from 'express';
import cors from 'cors';
import subscriptionsRouter from './routes/subscriptions';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/subscriptions', subscriptionsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
