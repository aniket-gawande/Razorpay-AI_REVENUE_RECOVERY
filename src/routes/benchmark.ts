import { Router } from 'express';
import type { Request, Response } from 'express';
import { executeBenchmark } from '../benchmark/runner';

const router = Router();

router.get('/run', (req: Request, res: Response) => {
  try {
    const batchSize = parseInt(req.query.batchSize as string) || 100;
    const results = executeBenchmark(batchSize);
    res.status(200).json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Benchmark execution failed' });
  }
});

export default router;
