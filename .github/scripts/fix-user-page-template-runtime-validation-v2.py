from pathlib import Path
import runpy

script_path = Path('.github/scripts/fix-user-page-template-runtime-validation.py')
text = script_path.read_text(encoding='utf-8')

old_import = '''  type Layer,
  type LayerDocument,
  type RasterLayer,'''
new_import = '''  type Layer,
  type LayerDocument,
  type Page,
  type RasterLayer,'''
if text.count(old_import) != 1:
    raise RuntimeError(f'expected one Page import match, got {text.count(old_import)}')
text = text.replace(old_import, new_import, 1)

old_blend = '''  const blendMode = value.blendMode;
  if (
    blendMode !== 'normal'
    && blendMode !== 'multiply'
    && blendMode !== 'screen'
    && blendMode !== 'add'
    && blendMode !== 'overlay'
  ) {
    throw new Error('INVALID_TEMPLATE_LAYER_BLEND_MODE');
  }

  const color = validateNullableColor(value.color);'''
new_blend = '''  const blendMode = validateBlendMode(value.blendMode);

  const color = validateNullableColor(value.color);'''
if text.count(old_blend) != 1:
    raise RuntimeError(f'expected one blend guard match, got {text.count(old_blend)}')
text = text.replace(old_blend, new_blend, 1)

old_helper = '''function validateNullableId(value: unknown, code: string): string | null {'''
new_helper = '''function validateBlendMode(value: unknown): Layer['blendMode'] {
  if (
    value === 'normal'
    || value === 'multiply'
    || value === 'screen'
    || value === 'add'
    || value === 'overlay'
  ) {
    return value;
  }
  throw new Error('INVALID_TEMPLATE_LAYER_BLEND_MODE');
}

function validateNullableId(value: unknown, code: string): string | null {'''
if text.count(old_helper) != 1:
    raise RuntimeError(f'expected one helper insertion match, got {text.count(old_helper)}')
text = text.replace(old_helper, new_helper, 1)

script_path.write_text(text, encoding='utf-8')
runpy.run_path(str(script_path), run_name='__main__')
