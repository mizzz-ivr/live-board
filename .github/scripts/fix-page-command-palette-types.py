from pathlib import Path

path = Path('apps/desktop/src/project-command-palette-model.ts')
text = path.read_text(encoding='utf-8')
old = "  readonly pageId?: string;\n  readonly toIndex?: number;"
new = "  readonly pageId?: string | undefined;\n  readonly toIndex?: number | undefined;"
if old not in text:
    raise RuntimeError('ProjectTabCommand optional payload type marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
