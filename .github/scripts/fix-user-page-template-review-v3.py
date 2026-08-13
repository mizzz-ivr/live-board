from pathlib import Path
import runpy

script_path = Path('.github/scripts/fix-user-page-template-review.py')
text = script_path.read_text(encoding='utf-8')

old_hook = '''replace_once(
    hook,
    """        templates: result.templates,
        message: result.warnings.length > 0""",
    """        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0""",
)'''
new_hook = '''replace_once(
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
if text.count(old_hook) != 1:
    raise RuntimeError(f'expected one hook patch-script match, got {text.count(old_hook)}')
text = text.replace(old_hook, new_hook, 1)

old_docs = '''replace_once(
    docs,
    """- Rasterの`sourceLayerIds`はLayer内参照として再マップします。""",
    """- Rasterの`sourceLayerIds`は、現在も存在するLayer IDだけを再マップします。Layer結合で削除済みになった履歴IDは生成Pageへ持ち込みません。""",
)'''
new_docs = '''replace_once(
    docs,
    """`assetId`が`null`のLayerは保存可能です。Rasterの`sourceLayerIds`はLayer内参照として再マップします。""",
    """`assetId`が`null`のLayerは保存可能です。Rasterの`sourceLayerIds`は、現在も存在するLayer IDだけを再マップします。Layer結合で削除済みになった履歴IDは生成Pageへ持ち込みません。""",
)'''
if text.count(old_docs) != 1:
    raise RuntimeError(f'expected one docs patch-script match, got {text.count(old_docs)}')
text = text.replace(old_docs, new_docs, 1)

script_path.write_text(text, encoding='utf-8')
runpy.run_path(str(script_path), run_name='__main__')
