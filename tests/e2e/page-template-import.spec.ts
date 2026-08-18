import { expect, test } from '@playwright/test';

const EXPORT_MAGIC = 'LIVEBOARD_PAGE_TEMPLATE\0';

function createAssetlessTemplateBundle(template: unknown): Buffer {
  const manifest = Buffer.from(JSON.stringify({
    kind: 'live-board-page-template',
    schemaVersion: 1,
    exportedAt: '2026-08-18T00:00:00.000Z',
    template,
    assetPayloads: [],
  }), 'utf8');
  const manifestLength = Buffer.alloc(4);
  manifestLength.writeUInt32LE(manifest.byteLength, 0);
  return Buffer.concat([
    Buffer.from(EXPORT_MAGIC, 'utf8'),
    manifestLength,
    manifest,
  ]);
}

test('`.liveboard-template`をDialogから読み込み、マイテンプレートとして再利用できる', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const templateButton = page.getByRole('button', {
    name: 'Pageテンプレートを開く',
  });
  await templateButton.click();
  let dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', {
    name: '配信開始待機テンプレートでPageを作成',
  }).click();

  await templateButton.click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('textbox', { name: 'マイテンプレート名' }).fill('Import E2E');
  await dialog.getByRole('button', {
    name: '現在のPageをマイテンプレートに保存',
  }).click();
  await expect(dialog.getByRole('status')).toContainText('Import E2E');

  const exportedTemplate = await page.evaluate(() => {
    const raw = localStorage.getItem('live-board:user-page-templates:v2');
    if (raw === null) throw new Error('マイテンプレートmetadataがありません');
    const parsed = JSON.parse(raw) as { templates?: unknown[] };
    const template = parsed.templates?.[0];
    if (template === undefined) throw new Error('Export対象テンプレートがありません');
    return template;
  });
  const bundle = createAssetlessTemplateBundle(exportedTemplate);

  page.once('dialog', async (confirmDialog) => {
    await confirmDialog.accept();
  });
  await dialog.getByRole('button', {
    name: 'Import E2Eマイテンプレートを削除',
  }).click();
  await expect(
    dialog.getByRole('button', {
      name: 'Import E2EマイテンプレートでPageを作成',
    }),
  ).toHaveCount(0);

  await dialog.locator('input[type="file"][accept=".liveboard-template"]').setInputFiles({
    name: 'import-e2e.liveboard-template',
    mimeType: 'application/octet-stream',
    buffer: bundle,
  });

  await expect(dialog.getByRole('status')).toContainText('「Import E2E」を読み込みました。Asset 0件。');
  const importedTemplate = dialog.getByRole('button', {
    name: 'Import E2EマイテンプレートでPageを作成',
  });
  await expect(importedTemplate).toBeVisible();
  await importedTemplate.click();

  await expect(dialog).toBeHidden();
  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(3);
  await expect(pageRows.nth(2)).toContainText('Import E2E');
});
