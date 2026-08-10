import { expect, test } from '@playwright/test';

test('コマンドパレットでPageを検索し、名前変更とUndo/Redoを実行できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  await page.getByRole('button', { name: 'ページを追加' }).click();
  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Project / Pageコマンド' });
  const search = dialog.getByRole('combobox', { name: 'コマンドを検索' });
  await search.fill('Pageを開く ページ 1');
  await page.keyboard.press('Enter');
  await expect(pageRows.nth(0)).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Control+K');
  await search.fill('page rename');
  page.once('dialog', async (prompt) => prompt.accept('待機オープニング'));
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-list')).toContainText('待機オープニング');

  await page.keyboard.press('Control+K');
  await search.fill('page undo');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-list')).toContainText('ページ 1');

  await page.keyboard.press('Control+K');
  await search.fill('page redo');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-list')).toContainText('待機オープニング');
});

test('Page削除確認と移動境界を安全に扱う', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  await page.getByRole('button', { name: 'ページを追加' }).click();
  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Project / Pageコマンド' });
  const search = dialog.getByRole('combobox', { name: 'コマンドを検索' });

  await search.fill('page 下へ');
  await expect(dialog.getByRole('option', { name: /編集中Pageを下へ移動/ }))
    .toHaveAttribute('aria-disabled', 'true');

  await search.fill('page 上へ');
  await page.keyboard.press('Enter');
  await expect(pageRows.nth(0)).toContainText('ページ 2');

  await page.keyboard.press('Control+K');
  await search.fill('page delete');
  page.once('dialog', async (confirm) => confirm.dismiss());
  await page.keyboard.press('Enter');
  await expect(pageRows).toHaveCount(2);

  await page.keyboard.press('Control+K');
  await search.fill('page delete');
  page.once('dialog', async (confirm) => confirm.accept());
  await page.keyboard.press('Enter');
  await expect(pageRows).toHaveCount(1);

  await page.keyboard.press('Control+K');
  await search.fill('page delete');
  await expect(dialog.getByRole('option', { name: /編集中Pageを削除/ }))
    .toHaveAttribute('aria-disabled', 'true');
});
