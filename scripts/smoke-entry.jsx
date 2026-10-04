// Bundled by scripts/smoke.mjs; kept out of the app build by living in scripts/.
const { renderToString } = require('react-dom/server');
const App = require('../src/App').default;

exports.render = () => renderToString(<App />);
