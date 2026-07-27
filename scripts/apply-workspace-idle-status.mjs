import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/desktop/src/useWorkspacePersistence.ts';
let source = await readFile(path, 'utf8');

function replaceOnce(before, after) {
  if (!source.includes(before)) {
    throw new Error(`WORKSPACE_IDLE_STATUS_TARGET_NOT_FOUND: ${before.slice(0, 80)}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "} from 'react';\n\nconst AUTOSAVE_DEBOUNCE_MS",
  "} from 'react';\nimport { resolveWorkspacePersistenceIdleStatus } from './workspace-persistence-status';\n\nconst AUTOSAVE_DEBOUNCE_MS",
);

const idleStatusExpression = `resolveWorkspacePersistenceIdleStatus({
            hasDocument: document !== null,
            revision: revisionRef.current,
            lastExplicitSaveRevision,
          })`;

replaceOnce(
  "          setStatus(document === null ? '保存: 未保存' : '保存: 変更あり');",
  `          setStatus(${idleStatusExpression});`,
);

const openSuccessBlock = `      if (opened) await refreshAfterSuccessfulLoad();
      return opened;`;
const openReplacement = `      if (opened) {
        await refreshAfterSuccessfulLoad();
      } else {
        setStatus(${idleStatusExpression});
      }
      return opened;`;
if (source.split(openSuccessBlock).length - 1 !== 2) {
  throw new Error('WORKSPACE_IDLE_STATUS_OPEN_COUNT_INVALID');
}
source = source.replaceAll(openSuccessBlock, openReplacement);

replaceOnce(
  '    [api, document, refresh],',
  '    [api, document, lastExplicitSaveRevision, refresh],',
);
replaceOnce(
  '  }, [api, loadOpenResponse, refreshAfterSuccessfulLoad]);',
  `  }, [
    api,
    document,
    lastExplicitSaveRevision,
    loadOpenResponse,
    refreshAfterSuccessfulLoad,
  ]);`,
);
replaceOnce(
  '    [api, loadOpenResponse, refreshAfterSuccessfulLoad],',
  `    [
      api,
      document,
      lastExplicitSaveRevision,
      loadOpenResponse,
      refreshAfterSuccessfulLoad,
    ],`,
);

await writeFile(path, source);
