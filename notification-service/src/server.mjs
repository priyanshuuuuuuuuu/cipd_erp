import express from 'express';
import { config } from './config.mjs';
import { drainStream, getQueueCounts, listMessages, retryMessage } from './stream.mjs';

const app = express();
app.use(express.json({ limit: '32kb' }));

function requireToken(req, res, next) {
  if (!config.serviceToken || req.get('authorization') !== 'Bearer ' + config.serviceToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', async (_req, res) => {
  try {
    res.json({
      ok: true,
      service: 'cipd-notification-service',
      sandbox: config.sandbox,
      queue: await getQueueCounts(),
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get('/messages', requireToken, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    res.json({ messages: await listMessages(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/drain', requireToken, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit || 20), 1), 100);
    res.json(await drainStream(limit));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/messages/:id/retry', requireToken, async (req, res) => {
  try {
    res.json(await retryMessage(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(config.port, () => {
  console.log('[notification-service] listening on port ' + config.port + '; sandbox=' + config.sandbox);
  setInterval(async () => {
    try {
      const result = await drainStream(20);
      if (result.claimed || result.retried || result.failed) {
        console.log('[notification-service] ' + JSON.stringify(result));
      }
    } catch (error) {
      console.error('[notification-service] drain failed:', error.message);
    }
  }, config.workerIntervalMs);
});

