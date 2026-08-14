from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'packages/domain/src/assets.ts',
    "function escapeAttribute(value: string): string { return value.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }",
    "function escapeAttribute(value: string): string { return value.replace(/&(?!amp;|quot;|lt;|gt;)/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }",
)

path = Path('packages/domain/test/assets.test.ts')
text = path.read_text(encoding='utf-8')
marker = """  it('DOCTYPE・ENTITYを含むSVGを拒否する', () => {
"""
addition = """  it('サニタイズ済みSVGを再処理してもXML entityを二重エスケープしない', () => {
    const source = `
      <svg viewBox="0 0 100 100">
        <text x="10" y="20" font-family="A &amp; B">A &amp; B</text>
      </svg>`;
    const first = sanitizeSvg(source);
    const second = sanitizeSvg(first);
    expect(second).toBe(first);
    expect(second).toContain('font-family="A &amp; B"');
    expect(second).not.toContain('&amp;amp;');
  });

  it('数値文字参照は既存entityとして扱わず無害化する', () => {
    const source = `
      <svg viewBox="0 0 10 10">
        <image href="jav&#x61;script:alert(1)" width="1" height="1" />
      </svg>`;
    const sanitized = sanitizeSvg(source);
    expect(sanitized).not.toContain('href=');
    expect(sanitized).not.toContain('javascript:');
  });

"""
if marker not in text:
    raise SystemExit('assets test marker not found')
path.write_text(text.replace(marker, addition + marker, 1), encoding='utf-8')

path = Path('apps/desktop/test/user-page-template-assets.test.ts')
text = path.read_text(encoding='utf-8')
marker = """  it('改ざんされた同梱Assetだけを含むテンプレートを読み込み時に除外する', () => {
"""
addition = """  it('XML entityを含む安全なSVG Assetを保存・再読込できる', () => {
    const storage = new MemoryStorage();
    const svg = new TextEncoder().encode(`
      <svg viewBox="0 0 100 100">
        <text x="10" y="20" font-family="A &amp; B">SAFE</text>
      </svg>`);
    const imported = importProjectAsset(createProjectAssetLibrary(), {
      fileName: 'entity.svg',
      declaredMime: 'image/svg+xml',
      bytes: svg,
      createdAt: '2026-08-14T00:00:00.000Z',
    });
    const template = createUserPageTemplate({
      templateId: 'user-template:svg-entity',
      name: 'SVG entity',
      page: imagePage(imported.asset.id),
      assetLibrary: imported.library,
      createdAt: '2026-08-14T00:10:00.000Z',
    });
    saveUserPageTemplate(storage, template);

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.templates).toHaveLength(1);
    expect(loaded.templates[0]?.assets[0]?.dataUrl).toBe(template.assets[0]?.dataUrl);
  });

"""
if marker not in text:
    raise SystemExit('template asset test marker not found')
path.write_text(text.replace(marker, addition + marker, 1), encoding='utf-8')
