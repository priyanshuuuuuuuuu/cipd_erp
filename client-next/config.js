// Last-resort SERVER fallback only (used when the cohort registry cannot be read). Never import from the frontend.
export const DEFAULT_SCHEMA = 'junedecember2026';
export const defaultSchema = DEFAULT_SCHEMA;

const config = {
  defaultSchema: DEFAULT_SCHEMA,
};

export default config;
