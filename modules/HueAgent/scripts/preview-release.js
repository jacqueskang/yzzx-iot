const { execSync } = require('child_process');

(async () => {
  try {
    const currentBranch = (process.env.BRANCH || execSync('git branch --show-current').toString().trim()).trim();
    const branches = [currentBranch, 'refs/pull/*/merge'].filter(Boolean).join(',');
    if (!branches) {
      throw new Error('No branch detected; cannot run semantic-release preview');
    }

    const output = execSync(`npx semantic-release --dry-run --ci=false --branches ${branches}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.error('Semantic-release output:', output);
    const versionMatch = output.match(/The next release version is (\d+\.\d+\.\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      console.log(JSON.stringify({ version, notes: '' }));
    } else {
      console.log(JSON.stringify({ version: null, notes: null }));
    }
  } catch (err) {
    console.error('Semantic-release preview failed:', err.message);
    console.log(JSON.stringify({ version: null, notes: null, error: err.message }));
    process.exit(0);
  }
})();
