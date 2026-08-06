from pathlib import Path

path = Path('apps/desktop/test/project-command-palette.test.ts')
source = path.read_text(encoding='utf-8')
source = source.replace("filterProjectTabCommands(commands, '  GAME　待機  ')", "filterProjectTabCommands(commands, '  ゲーム　待機  ')")
source = source.replace("filterProjectTabCommands(commands, 'project 複製')", "filterProjectTabCommands(commands, 'PROJECT 複製')")
path.write_text(source, encoding='utf-8')
