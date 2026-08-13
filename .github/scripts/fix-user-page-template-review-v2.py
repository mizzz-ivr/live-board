from pathlib import Path
import runpy

script_path = Path('.github/scripts/fix-user-page-template-review.py')
text = script_path.read_text(encoding='utf-8')
old = '''replace_once(
    hook,
    """        templates: result.templates,
        message: result.warnings.length > 0""",
    """        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0""",
)'''
new = '''replace_once(
    hook,
    """      setState({
        enabled: true,
        templates: result.templates,
        message: result.warnings.length > 0
          ? `「${template.name}」を保存しました。${result.warnings.join(' ')}`""",
    """      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0
          ? `「${template.name}」を保存しました。${result.warnings.join(' ')}`""",
)'''
if text.count(old) != 1:
    raise RuntimeError(f'expected one patch-script match, got {text.count(old)}')
script_path.write_text(text.replace(old, new, 1), encoding='utf-8')
runpy.run_path(str(script_path), run_name='__main__')
