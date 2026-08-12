from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected text not found in {path}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "apps/desktop/src/AppV2.tsx",
    'aria-label="テンプレートからページを追加"',
    'aria-label="Pageテンプレートを開く"',
)
replace_once(
    "tests/e2e/page-template-gallery.spec.ts",
    "name: 'テンプレートからページを追加',",
    "name: 'Pageテンプレートを開く',",
)
