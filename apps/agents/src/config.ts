export const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
export const BASE_URL = process.env.BASE_URL;

if (!ACCESS_TOKEN) {
  console.error('env ACCESS_TOKEN not available');
  process.exit(1);
}
if (!BASE_URL) {
  console.error('env BASE_URL not available');
  process.exit(1);
}