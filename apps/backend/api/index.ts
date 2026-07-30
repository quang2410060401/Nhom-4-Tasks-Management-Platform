import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config, forwardToNest } from './_handler';

export { config };

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Keep the root /api endpoint lightweight so it can confirm routing even
  // when the full Nest app is blocked by DB or other runtime dependencies.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.status(200).json({
      statusCode: 200,
      message: 'Tasks Management Platform backend is running',
    });
    return;
  }

  await forwardToNest(req, res);
}
