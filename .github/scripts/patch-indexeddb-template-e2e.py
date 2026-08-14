from pathlib import Path

path = Path('tests/e2e/page-template-gallery.spec.ts')
text = path.read_text(encoding='utf-8')
old = """  await expect(dialog.getByRole('status')).toContainText('ロゴ付きシーン');
  await expect(dialog.getByText(/Asset 1件/)).toBeVisible();

  await page.reload();
"""
new = """  await expect(dialog.getByRole('status')).toContainText('ロゴ付きシーン');
  await expect(dialog.getByText(/Asset 1件/)).toBeVisible();

  const persisted = await page.evaluate(async () => {
    const metadata = localStorage.getItem('live-board:user-page-templates:v2') ?? '';
    const binaryAssetCount = await new Promise<number>((resolve, reject) => {
      const openRequest = indexedDB.open('live-board-user-page-template-assets');
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        const transaction = database.transaction('assets', 'readonly');
        const countRequest = transaction.objectStore('assets').count();
        countRequest.onerror = () => reject(countRequest.error);
        countRequest.onsuccess = () => {
          const count = countRequest.result;
          database.close();
          resolve(count);
        };
      };
    });
    return {
      metadata,
      binaryAssetCount,
    };
  });
  expect(persisted.metadata).not.toContain('data:image/');
  expect(persisted.metadata).not.toContain('base64,');
  expect(persisted.binaryAssetCount).toBe(1);

  await page.reload();
"""
if old not in text:
    raise SystemExit('asset E2E insertion marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
