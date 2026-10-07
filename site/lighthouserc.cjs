// Lighthouse CI: static server on dist/, three runs per page, thresholds at 0.95 as warnings
// (LHCI_ASSERT_LEVEL=error turns them into failures for a local gate).
const level = process.env.LHCI_ASSERT_LEVEL || 'warn';
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['http://localhost/index.html', 'http://localhost/en.html', 'http://localhost/impressum.html'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new --disable-gpu',
        // Cloudflare serves `/en`, the static server needs `/en.html`; same page either way.
      },
    },
    assert: {
      assertions: {
        'categories:performance': [level, { minScore: 0.95 }],
        'categories:accessibility': [level, { minScore: 0.95 }],
        'categories:best-practices': [level, { minScore: 0.95 }],
        'categories:seo': [level, { minScore: 0.95 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci', reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%.%%EXTENSION%%' },
  },
};
