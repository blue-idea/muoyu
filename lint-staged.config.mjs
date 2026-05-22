const lintStagedConfig = {
  "*.{ts,tsx}": ["eslint --max-warnings=0", () => "tsc --noEmit --pretty false"],
};

export default lintStagedConfig;
