from pathlib import Path

path = Path('apps/desktop/src/AppV2.tsx')
text = path.read_text(encoding='utf-8')
old = '''      const nextCommandState = dispatchWorkspaceCommandWithCanvasHistory(
        commandState,
        createAddProjectCommand(
          commandState.workspace.id,
          nextProject,
          createCommandMetadata('project-duplicate'),
        ),
      );
      const sourceLibrary =
        assetLibraries[projectId] ?? createProjectAssetLibrary();

      setAssetLibraries((current) => ({
        ...current,
        [nextProject.id]: cloneProjectAssetLibrary(sourceLibrary),
      }));
      setCommandState(nextCommandState);
'''
new = '''      const command = createAddProjectCommand(
        commandState.workspace.id,
        nextProject,
        createCommandMetadata('project-duplicate'),
      );
      const validatedState = dispatchWorkspaceCommandWithCanvasHistory(
        commandState,
        command,
      );
      const sourceLibrary =
        assetLibraries[projectId] ?? createProjectAssetLibrary();

      setAssetLibraries((current) => ({
        ...current,
        [nextProject.id]: cloneProjectAssetLibrary(sourceLibrary),
      }));
      setCommandState((current) =>
        current === commandState
          ? validatedState
          : dispatchWorkspaceCommandWithCanvasHistory(current, command),
      );
'''
if old not in text:
    raise RuntimeError('Project duplicate state update target not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
