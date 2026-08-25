import { Router } from 'express';
import { executeBenchmark } from '../benchmark/runner';
const router = Router();
router.get('/run', (req, res) => {
    try {
        const batchSize = parseInt(req.query.batchSize) || 100;
        const results = executeBenchmark(batchSize);
        res.status(200).json(results);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Benchmark execution failed' });
    }
});
export default router;
//# sourceMappingURL=benchmark.js.map