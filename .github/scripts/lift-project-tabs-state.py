from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'anchor not found: {path}\n{old[:160]}')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


replace_once(
    'apps/desktop/src/AppV2.tsx',
    "import { ProjectTabs } from './ProjectTabs';\nimport { RichLayerInspector } from './RichLayerInspector';",
    "import { ProjectTabs } from './ProjectTabs';\nimport {\n  createProjectTabsState,\n  synchronizeProjectTabsState,\n} from './project-tabs-model';\nimport { RichLayerInspector } from './RichLayerInspector';",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  const [hasEditorSession, setHasEditorSession] = useState(
    initialApplicationSurface() === 'editor',
  );
  const [toolId, setToolId] = useState<CanvasToolId>('pen');
""",
    """  const [hasEditorSession, setHasEditorSession] = useState(
    initialApplicationSurface() === 'editor',
  );
  const [projectTabsState, setProjectTabsState] = useState(() =>
    createProjectTabsState(
      initialCommandState.workspace.id,
      initialCommandState.workspace.projects.map((project) => project.id),
    ),
  );
  const [toolId, setToolId] = useState<CanvasToolId>('pen');
""",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  const project =
    workspace.projects.find((candidate) => candidate.id === workspace.activeProjectId) ??
    workspace.projects[0]!;
  const broadcastControls = useBroadcastControls({
""",
    """  const project =
    workspace.projects.find((candidate) => candidate.id === workspace.activeProjectId) ??
    workspace.projects[0]!;
  const projectIds = workspace.projects.map((candidate) => candidate.id);
  const currentProjectTabsState = synchronizeProjectTabsState(
    projectTabsState,
    workspace.id,
    projectIds,
    project.id,
  );
  const broadcastControls = useBroadcastControls({
""",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  useEffect(() => {
    setSelection(null);
    setSelectionMode(null);
  }, [editPage.id]);

  useEffect(() => {
    const liveBoardApi = window.liveBoard;
""",
    """  useEffect(() => {
    setSelection(null);
    setSelectionMode(null);
  }, [editPage.id]);

  useEffect(() => {
    if (currentProjectTabsState !== projectTabsState) {
      setProjectTabsState(currentProjectTabsState);
    }
  }, [currentProjectTabsState, projectTabsState]);

  useEffect(() => {
    const liveBoardApi = window.liveBoard;
""",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    """        <ProjectTabs
          workspaceId={workspace.id}
          projects={workspace.projects}
          activeProjectId={project.id}
          hasUnsavedChanges={persistence.hasUnsavedChanges}
          onSelect={selectProject}
          onCreate={createProjectTab}
        />
""",
    """        <ProjectTabs
          tabs={currentProjectTabsState}
          projects={workspace.projects}
          activeProjectId={project.id}
          hasUnsavedChanges={persistence.hasUnsavedChanges}
          onTabsChange={setProjectTabsState}
          onSelect={selectProject}
          onCreate={createProjectTab}
        />
""",
)

Path('.github/workflows/lift-project-tabs-state.yml').unlink(missing_ok=True)
Path('.github/scripts/lift-project-tabs-state.py').unlink(missing_ok=True)
