import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`${path}: expected source was not found`);
  }
  const next = source.replace(before, after);
  if (next === source) throw new Error(`${path}: replacement made no change`);
  await writeFile(path, next);
}

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `import {\n  createCanvasWorkspaceCommandState,`,
  `import {\n  createCanvasWorkspaceCommandState,\n  createEmptyWorkspace,`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  revision: number;\n  save(): Promise<void>;\n  saveAs(): Promise<void>;\n  open(): Promise<void>;\n  importCopy(): Promise<void>;\n  duplicateCurrent(): void;\n  openRecent(documentId: string): Promise<void>;\n  toggleFavorite(documentId: string, favorite: boolean): Promise<void>;\n  restore(candidateId: string): Promise<void>;`,
  `  revision: number;\n  hasUnsavedChanges: boolean;\n  createNew(): void;\n  save(): Promise<void>;\n  saveAs(): Promise<void>;\n  open(): Promise<boolean>;\n  importCopy(): Promise<void>;\n  duplicateCurrent(): void;\n  openRecent(documentId: string): Promise<boolean>;\n  toggleFavorite(documentId: string, favorite: boolean): Promise<void>;\n  restore(candidateId: string): Promise<boolean>;`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const [revision, setRevision] = useState(0);\n  const revisionRef = useRef(0);`,
  `  const [revision, setRevision] = useState(0);\n  const [lastExplicitSaveRevision, setLastExplicitSaveRevision] = useState<\n    number | null\n  >(null);\n  const revisionRef = useRef(0);`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `      revisionRef.current = 0;\n      setRevision(0);\n      input.setCommandState(createCanvasWorkspaceCommandState(bundle.workspace));`,
  `      revisionRef.current = 0;\n      setRevision(0);\n      setLastExplicitSaveRevision(nextDocument === null ? null : 0);\n      input.setCommandState(createCanvasWorkspaceCommandState(bundle.workspace));`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const saveWithMode = useCallback(`,
  `  const createNew = useCallback((): void => {\n    applyBundle(\n      {\n        workspace: createEmptyWorkspace(createWorkspaceId('new')),\n        assetLibraries: {},\n      },\n      null,\n    );\n    setStatus('保存: 新規作成・未保存');\n  }, [applyBundle]);\n\n  const saveWithMode = useCallback(`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `        setDocument(response.document);\n        setStatus('保存: 明示保存済み');`,
  `        setDocument(response.document);\n        setLastExplicitSaveRevision(revisionRef.current);\n        setStatus('保存: 明示保存済み');`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const loadOpenResponse = useCallback(\n    (response: WorkspaceOpenResponse): void => {\n      if (response.canceled) return;\n      if (response.archive === undefined || response.document === undefined) {\n        throw new Error('読込結果が不完全です');\n      }\n      const loaded = loadLiveboardArchive(response.archive);\n      applyBundle(\n        {\n          workspace: loaded.workspace,\n          assetLibraries: loaded.assetLibraries,\n        },\n        response.document,\n      );\n    },`,
  `  const loadOpenResponse = useCallback(\n    (response: WorkspaceOpenResponse): boolean => {\n      if (response.canceled) return false;\n      if (response.archive === undefined || response.document === undefined) {\n        throw new Error('読込結果が不完全です');\n      }\n      const loaded = loadLiveboardArchive(response.archive);\n      applyBundle(\n        {\n          workspace: loaded.workspace,\n          assetLibraries: loaded.assetLibraries,\n        },\n        response.document,\n      );\n      return true;\n    },`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const open = useCallback(async (): Promise<void> => {\n    if (api === undefined) return;\n    setBusy(true);\n    setStatus('保存: 読込中');\n    try {\n      loadOpenResponse(\n        await api.openWorkspace(globalThis.crypto.randomUUID()),\n      );\n      await refresh();\n    } catch (caught: unknown) {\n      setStatus('保存: 読込失敗');\n      setError(errorMessage(caught, 'ワークスペースの読込に失敗しました'));\n    } finally {\n      setBusy(false);\n    }\n  }, [api, loadOpenResponse, refresh]);`,
  `  const open = useCallback(async (): Promise<boolean> => {\n    if (api === undefined) return false;\n    setBusy(true);\n    setStatus('保存: 読込中');\n    try {\n      const opened = loadOpenResponse(\n        await api.openWorkspace(globalThis.crypto.randomUUID()),\n      );\n      if (opened) await refresh();\n      return opened;\n    } catch (caught: unknown) {\n      setStatus('保存: 読込失敗');\n      setError(errorMessage(caught, 'ワークスペースの読込に失敗しました'));\n      return false;\n    } finally {\n      setBusy(false);\n    }\n  }, [api, loadOpenResponse, refresh]);`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const openRecent = useCallback(\n    async (documentId: string): Promise<void> => {\n      if (api === undefined) return;\n      setBusy(true);\n      setStatus('保存: 最近使用を読込中');\n      try {\n        loadOpenResponse(\n          await api.openRecentWorkspace(\n            globalThis.crypto.randomUUID(),\n            documentId,\n          ),\n        );\n        await refresh();\n      } catch (caught: unknown) {\n        setStatus('保存: 読込失敗');\n        setError(errorMessage(caught, '最近使用したファイルを開けませんでした'));\n      } finally {\n        setBusy(false);\n      }\n    },`,
  `  const openRecent = useCallback(\n    async (documentId: string): Promise<boolean> => {\n      if (api === undefined) return false;\n      setBusy(true);\n      setStatus('保存: 最近使用を読込中');\n      try {\n        const opened = loadOpenResponse(\n          await api.openRecentWorkspace(\n            globalThis.crypto.randomUUID(),\n            documentId,\n          ),\n        );\n        if (opened) await refresh();\n        return opened;\n      } catch (caught: unknown) {\n        setStatus('保存: 読込失敗');\n        setError(errorMessage(caught, '最近使用したファイルを開けませんでした'));\n        return false;\n      } finally {\n        setBusy(false);\n      }\n    },`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `    async (documentId: string, favorite: boolean): Promise<void> => {\n      if (api === undefined) return;\n      try {`,
  `    async (documentId: string, favorite: boolean): Promise<void> => {\n      if (api === undefined) return;\n      setBusy(true);\n      try {`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `      } catch (caught: unknown) {\n        setError(errorMessage(caught, 'お気に入りの更新に失敗しました'));\n      }\n    },\n    [api, refresh],`,
  `      } catch (caught: unknown) {\n        setError(errorMessage(caught, 'お気に入りの更新に失敗しました'));\n      } finally {\n        setBusy(false);\n      }\n    },\n    [api, refresh],`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const restore = useCallback(\n    async (candidateId: string): Promise<void> => {\n      if (api === undefined) return;\n      setBusy(true);\n      setStatus('保存: 復元中');\n      try {\n        const response = await api.loadRecoveryCandidate(\n          globalThis.crypto.randomUUID(),\n          candidateId,\n        );\n        const loaded = loadLiveboardArchive(response.archive);\n        applyBundle(\n          {\n            workspace: loaded.workspace,\n            assetLibraries: loaded.assetLibraries,\n          },\n          null,\n        );\n        await api.discardRecoveryCandidate(\n          globalThis.crypto.randomUUID(),\n          candidateId,\n          revisionRef.current,\n        );\n        setStatus('保存: 復元済み・未保存');\n        await refresh();\n      } catch (caught: unknown) {\n        setStatus('保存: 復元失敗');\n        setError(errorMessage(caught, 'クラッシュ復元に失敗しました'));\n      } finally {\n        setBusy(false);\n      }\n    },\n    [api, applyBundle, refresh],\n  );`,
  `  const restore = useCallback(\n    async (candidateId: string): Promise<boolean> => {\n      if (api === undefined) return false;\n      setBusy(true);\n      setStatus('保存: 復元中');\n      try {\n        const candidate = recoveryCandidates.find(\n          (item) => item.candidateId === candidateId,\n        );\n        if (candidate === undefined) throw new Error('復元候補が見つかりません');\n        const response = await api.loadRecoveryCandidate(\n          globalThis.crypto.randomUUID(),\n          candidateId,\n        );\n        const loaded = loadLiveboardArchive(response.archive);\n        await api.discardRecoveryCandidate(\n          globalThis.crypto.randomUUID(),\n          candidateId,\n          candidate.revision,\n        );\n        applyBundle(\n          {\n            workspace: loaded.workspace,\n            assetLibraries: loaded.assetLibraries,\n          },\n          null,\n        );\n        setStatus('保存: 復元済み・未保存');\n        await refresh();\n        return true;\n      } catch (caught: unknown) {\n        setStatus('保存: 復元失敗');\n        setError(errorMessage(caught, 'クラッシュ復元に失敗しました'));\n        return false;\n      } finally {\n        setBusy(false);\n      }\n    },\n    [api, applyBundle, recoveryCandidates, refresh],\n  );`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `  const discard = useCallback(\n    async (candidateId: string): Promise<void> => {\n      if (api === undefined) return;\n      try {\n        await api.discardRecoveryCandidate(\n          globalThis.crypto.randomUUID(),\n          candidateId,\n          revisionRef.current,\n        );\n        await refresh();\n      } catch (caught: unknown) {\n        setError(errorMessage(caught, '復元候補の破棄に失敗しました'));\n      }\n    },\n    [api, refresh],\n  );\n\n  return {`,
  `  const discard = useCallback(\n    async (candidateId: string): Promise<void> => {\n      if (api === undefined) return;\n      setBusy(true);\n      try {\n        const candidate = recoveryCandidates.find(\n          (item) => item.candidateId === candidateId,\n        );\n        if (candidate === undefined) throw new Error('復元候補が見つかりません');\n        await api.discardRecoveryCandidate(\n          globalThis.crypto.randomUUID(),\n          candidateId,\n          candidate.revision,\n        );\n        await refresh();\n      } catch (caught: unknown) {\n        setError(errorMessage(caught, '復元候補の破棄に失敗しました'));\n      } finally {\n        setBusy(false);\n      }\n    },\n    [api, recoveryCandidates, refresh],\n  );\n\n  const hasUnsavedChanges =\n    document === null ||\n    lastExplicitSaveRevision === null ||\n    revision !== lastExplicitSaveRevision;\n\n  return {`,
);

await replace(
  'apps/desktop/src/useWorkspacePersistence.ts',
  `    revision,\n    save: () => saveWithMode(false),`,
  `    revision,\n    hasUnsavedChanges,\n    createNew,\n    save: () => saveWithMode(false),`,
);

await replace(
  'apps/desktop/src/useBroadcastControls.ts',
  `  projectId: string;\n}`,
  `  projectId: string;\n  enabled?: boolean;\n}`,
);

await replace(
  'apps/desktop/src/useBroadcastControls.ts',
  `  projectId,\n}: UseBroadcastControlsOptions): BroadcastControlsController {`,
  `  projectId,\n  enabled = true,\n}: UseBroadcastControlsOptions): BroadcastControlsController {`,
);

await replace(
  'apps/desktop/src/useBroadcastControls.ts',
  `  useEffect(() => {\n    const handleKeyDown = (event: KeyboardEvent) => {`,
  `  useEffect(() => {\n    if (!enabled) return;\n    const handleKeyDown = (event: KeyboardEvent) => {`,
);

await replace(
  'apps/desktop/src/useBroadcastControls.ts',
  `  }, [navigate, toggleLock]);`,
  `  }, [enabled, navigate, toggleLock]);`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `import { WorkspacePersistencePanel } from './WorkspacePersistencePanel';`,
  `import { WorkspaceHome } from './WorkspaceHome';\nimport { WorkspacePersistencePanel } from './WorkspacePersistencePanel';`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `type CopyStatus = 'idle' | 'copied' | 'error';`,
  `type CopyStatus = 'idle' | 'copied' | 'error';\ntype ApplicationSurface = 'home' | 'editor';\n\nconst E2E_START_SURFACE_KEY = 'live-board:e2e-start-surface';`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');`,
  `  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');\n  const [surface, setSurface] = useState<ApplicationSurface>(initialApplicationSurface);\n  const [hasEditorSession, setHasEditorSession] = useState(\n    initialApplicationSurface() === 'editor',\n  );`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `    setCommandState,\n    projectId: project.id,\n  });`,
  `    setCommandState,\n    projectId: project.id,\n    enabled: surface === 'editor',\n  });`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `    if (liveBoardApi === undefined || securityStatus === null) return;`,
  `    if (\n      surface !== 'editor' ||\n      liveBoardApi === undefined ||\n      securityStatus === null\n    ) return;`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `  }, [\n    securityStatus,`,
  `  }, [\n    surface,\n    securityStatus,`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `  const layerPanelSetter = setCommandState as unknown as Dispatch<`,
  `  function resetEditorPresentation(): void {\n    setSelection(null);\n    setSelectionMode(null);\n    setViewport(DEFAULT_CANVAS_VIEWPORT);\n    setAssetError(null);\n    setDomainError(null);\n    setBroadcastRevision(null);\n    registeredBroadcastAssetHashesRef.current.clear();\n  }\n\n  function enterEditor(): void {\n    resetEditorPresentation();\n    setHasEditorSession(true);\n    setSurface('editor');\n  }\n\n  function confirmWorkspaceReplacement(actionLabel: string): boolean {\n    if (!hasEditorSession || !persistence.hasUnsavedChanges) return true;\n    return window.confirm(\n      `未保存の編集セッションを保持しています。${actionLabel}と現在の内容は置き換わります。続行しますか？`,\n    );\n  }\n\n  function createWorkspaceFromHome(): void {\n    if (!confirmWorkspaceReplacement('新しいワークスペースを作成する')) return;\n    persistence.createNew();\n    enterEditor();\n  }\n\n  async function openWorkspaceFromHome(): Promise<void> {\n    if (!confirmWorkspaceReplacement('ファイルを開く')) return;\n    if (await persistence.open()) enterEditor();\n  }\n\n  async function openRecentFromHome(documentId: string): Promise<void> {\n    if (!confirmWorkspaceReplacement('最近使用したワークスペースを開く')) return;\n    if (await persistence.openRecent(documentId)) enterEditor();\n  }\n\n  async function restoreFromHome(candidateId: string): Promise<void> {\n    if (!confirmWorkspaceReplacement('クラッシュ復元を実行する')) return;\n    if (await persistence.restore(candidateId)) enterEditor();\n  }\n\n  function returnToHome(): void {\n    if (\n      persistence.hasUnsavedChanges &&\n      !window.confirm(\n        '未保存の変更は破棄せずメモリ上に保持したままホームへ戻ります。続行しますか？',\n      )\n    ) {\n      return;\n    }\n    setSurface('home');\n  }\n\n  const layerPanelSetter = setCommandState as unknown as Dispatch<`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `  return (\n    <div className="app-shell">`,
  `  if (surface === 'home') {\n    return (\n      <WorkspaceHome\n        controller={persistence}\n        currentWorkspaceName={workspace.name}\n        hasEditorSession={hasEditorSession}\n        onContinueEditing={() => setSurface('editor')}\n        onCreateNew={createWorkspaceFromHome}\n        onOpen={openWorkspaceFromHome}\n        onOpenRecent={openRecentFromHome}\n        onRestore={restoreFromHome}\n      />\n    );\n  }\n\n  return (\n    <div className="app-shell">`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `        <div className="topbar-actions">\n          <span className="status-dot" aria-hidden="true" />`,
  `        <div className="topbar-actions">\n          <button type="button" onClick={returnToHome}>ホーム</button>\n          <span className="status-dot" aria-hidden="true" />`,
);

await replace(
  'apps/desktop/src/AppV2.tsx',
  `function createEntityId(prefix: string): string {`,
  `function initialApplicationSurface(): ApplicationSurface {\n  try {\n    return window.localStorage.getItem(E2E_START_SURFACE_KEY) === 'editor'\n      ? 'editor'\n      : 'home';\n  } catch {\n    return 'home';\n  }\n}\n\nfunction createEntityId(prefix: string): string {`,
);

await replace(
  'playwright.config.ts',
  `        baseURL: 'http://127.0.0.1:4173',`,
  `        baseURL: 'http://127.0.0.1:4173',\n        storageState: {\n          cookies: [],\n          origins: [\n            {\n              origin: 'http://127.0.0.1:4173',\n              localStorage: [\n                { name: 'live-board:e2e-start-surface', value: 'editor' },\n              ],\n            },\n          ],\n        },`,
);
