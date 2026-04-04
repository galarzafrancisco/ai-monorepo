// TODO: this needs to be passed as a cli arg
export const WORK_DIR = process.env.WORK_DIR || '';

export const RUN_ID_HEADER = 'x-taico-run-id';

if (!WORK_DIR) {
  console.error('env WORK_DIR not available');
  process.exit(1);
}
