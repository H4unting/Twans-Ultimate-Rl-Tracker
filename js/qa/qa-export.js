/** Export QA datasets as JSON downloads */

import { collectQaGames } from './qa-generators.js';
import { QA_NOTE_PREFIX } from './qa-constants.js';

export function downloadQaDataset(allGames, { filename = 'twans-qa-dataset.json' } = {}) {
  const qaGames = collectQaGames(allGames);
  const payload = {
    exportedAt: new Date().toISOString(),
    marker: QA_NOTE_PREFIX,
    count: qaGames.length,
    games: qaGames,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return qaGames.length;
}
