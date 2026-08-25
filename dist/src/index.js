import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webhookRouter from './routes/webhook';
import recoveryRouter from './routes/recovery';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
// Routes
app.use('/api/webhooks', webhookRouter);
app.use('/api/recovery', recoveryRouter);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'razorpay-dunningcore' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map