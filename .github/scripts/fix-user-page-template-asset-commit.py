from pathlib import Path

path = Path('apps/desktop/src/AppV2.tsx')
text = path.read_text(encoding='utf-8')
old = """      setAssetLibraries((current) => ({
        ...current,
        [project.id]: instantiated.assetLibrary,
      }));
      setCommandState((current) =>
        current === commandState
          ? validatedState
          : dispatchProjectCommandWithCanvasHistory(current, command),
      );
"""
new = """      setAssetLibraries((current) => ({
        ...current,
        [project.id]: instantiated.assetLibrary,
      }));
      setCommandState(validatedState);
"""
if old not in text:
    raise SystemExit('AppV2 asset template commit pattern not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
