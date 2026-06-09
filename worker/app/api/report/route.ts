import { handleReport } from '../../../src/report';
import { getEnv } from '../../../src/env';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const env = await getEnv();
  return handleReport(request, env);
}
