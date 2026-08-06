from pathlib import Path

path = Path('apps/desktop/test/project-command-palette.test.ts')
source = path.read_text(encoding='utf-8')
source = source.replace("filterProjectTabCommands(commands, '  GAME　待機  ')", "filterProjectTabCommands(commands, '  ゲーム　待機  ')")
source = source.replace("filterProjectTabCommands(commands, 'project 複製')", "filterProjectTabCommands(commands, 'RENAME')")
source = source.replace(").toEqual(['duplicate-active']);", ").toEqual(['rename-active']);")
path.write_text(source, encoding='utf-8')
