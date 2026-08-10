from pathlib import Path

path = Path('apps/desktop/test/project-command-palette.test.ts')
text = path.read_text(encoding='utf-8')
old = "filterProjectTabCommands(commands, 'RENAME')"
new = "filterProjectTabCommands(commands, 'PROJECT RENAME')"
if old not in text:
    raise RuntimeError('search test marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
