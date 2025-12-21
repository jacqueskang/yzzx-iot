const semanticRelease = require('semantic-release');

(async () => {
  try {
    const result = await semanticRelease({
      dryRun: true,
      ci: false,
      branches: ['main']
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
