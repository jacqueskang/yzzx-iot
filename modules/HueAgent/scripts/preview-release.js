const semanticRelease = require('semantic-release');
const { execSync } = require('child_process');

(async () => {
  try {
    const currentBranch = execSync('git branch --show-current').toString().trim();
    const result = await semanticRelease({
      dryRun: true,
      ci: false,
      branches: [currentBranch]
    });
    if (result && result.nextRelease) {
      const { version, notes } = result.nextRelease;
      console.log(JSON.stringify({ version, notes }));
    } else {
      console.log(JSON.stringify({ version: null, notes: null }));
    }
  } catch (err) {
    console.error('Semantic-release preview failed:', err.message);
    console.log(JSON.stringify({ version: null, notes: null, error: err.message }));
    process.exit(0);
  }
})();
