import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('起動直後のホームから新規作成し、未保存セッションを保持して復帰できる', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'ワークスペースホーム' }),
  ).toBeVisible();
  await expect(page.getByText('Browser Preview', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /ファイルから開く/ }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: '更新' })).toBeDisabled();
  await expect(
    page.getByText('最近使用したワークスペースはありません。'),
  ).toBeVisible();
  await expect(page.getByText('復元候補はありません。')).toBeVisible();

  await page.getByRole('button', { name: /新しいワークスペース/ }).click();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('メモリ上に保持');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'ホーム', exact: true }).click();

  await expect(
    page.getByRole('heading', { name: 'ワークスペースホーム' }),
  ).toBeVisible();
  await expect(
    page.getByText('未保存の変更をメモリ上に保持しています'),
  ).toBeVisible();

  await page.getByRole('button', { name: '編集を続ける' }).click();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
});

test('ホームへ戻る確認をキャンセルした場合はEditorを維持する', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /新しいワークスペース/ }).click();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'ホーム', exact: true }).click();

  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'ワークスペースホーム' }),
  ).toHaveCount(0);
});
