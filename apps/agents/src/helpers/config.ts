export const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
export const BASE_URL = process.env.BASE_URL || '';
export const WORK_DIR = process.env.WORK_DIR || '';
export const REPO = process.env.REPO || '';
export const AGENT_SLUG = process.env.AGENT_SLUG || '';

export const RUN_ID_HEADER = 'x-taico-run-id';

if (!ACCESS_TOKEN) {
  console.error('env ACCESS_TOKEN not available');
  process.exit(1);
}
if (!BASE_URL) {
  console.error('env BASE_URL not available');
  process.exit(1);
}
if (!WORK_DIR) {
  console.error('env WORK_DIR not available');
  process.exit(1);
}
if (!REPO) {
  console.error('env REPO not available');
  process.exit(1);
}
if (!AGENT_SLUG) {
  console.error('env AGENT_SLUG not available');
  process.exit(1);
}
