import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/desktop/src/useWorkspacePersistence.ts';
let source = await readFile(path, 'utf8');

function replaceOnce(before, after) {
  if (!source.includes(before)) {
    throw new Error(`WORKSPACE_HOME_REFRESH_TARGET_NOT_FOUND: ${before.slice(0, 80)}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "  useEffect(() => {\n    if (api === undefined) return;",
  "  const refreshAfterSuccessfulLoad = useCallback(async (): Promise<void> => {\n    try {\n      await refresh();\n    } catch (caught: unknown) {\n      setError(errorMessage(caught, '一覧情報の再取得に失敗しました'));\n    }\n  }, [refresh]);\n\n  useEffect(() => {\n    if (api === undefined) return;",
);

const refreshCall = '      if (opened) await refresh();';
if (source.split(refreshCall).length - 1 !== 2) {
  throw new Error('WORKSPACE_HOME_REFRESH_OPEN_COUNT_INVALID');
}
source = source.replaceAll(
  refreshCall,
  '      if (opened) await refreshAfterSuccessfulLoad();',
);

replaceOnce(
  '  }, [api, loadOpenResponse, refresh]);',
  '  }, [api, loadOpenResponse, refreshAfterSuccessfulLoad]);',
);
replaceOnce(
  '    [api, loadOpenResponse, refresh],',
  '    [api, loadOpenResponse, refreshAfterSuccessfulLoad],',
);
replaceOnce(
  "        setStatus('保存: 復元済み・未保存');\n        await refresh();\n        return true;",
  "        setStatus('保存: 復元済み・未保存');\n        await refreshAfterSuccessfulLoad();\n        return true;",
);
replaceOnce(
  '    [api, applyBundle, recoveryCandidates, refresh],',
  '    [api, applyBundle, recoveryCandidates, refreshAfterSuccessfulLoad],',
);

await writeFile(path, source);
