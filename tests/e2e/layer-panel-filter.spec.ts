import { expect, test } from '@playwright/test';

test('Layer名検索で一致Layerと祖先Folderだけを表示する', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  await page.getByRole('button', { name: 'フォルダー', exact: true }).click();
  await page.getByRole('button', { name: 'テキスト', exact: true }).click();
  await page.getByRole('button', { name: '図形', exact: true }).click();

  const tree = page.getByRole('tree', { name: 'レイヤーツリー' });
  await expect(tree.getByRole('treeitem')).toHaveCount(3);

  const search = page.getByRole('searchbox', { name: '名前検索' });
  await search.fill('  テキスト   2  ');

  await expect(page.getByRole('status').filter({ hasText: '1件一致 / 全3件' })).toBeVisible();
  await expect(tree.getByRole('treeitem')).toHaveCount(2);
  await expect(tree).toContainText('フォルダー 1');
  await expect(tree).toContainText('テキスト 2');
  await expect(tree).not.toContainText('図形 3');
});

test('Layer種類と表示状態を組み合わせて絞り込み、解除できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  await page.getByRole('button', { name: 'ラスター', exact: true }).click();
  await page.getByRole('button', { name: 'テキスト', exact: true }).click();

  await page
    .getByRole('button', { name: 'テキスト 2の表示を切り替え' })
    .click();

  const typeFilter = page.getByLabel('レイヤー種類');
  const visibilityFilter = page.getByLabel('レイヤー表示状態');
  const tree = page.getByRole('tree', { name: 'レイヤーツリー' });

  await typeFilter.selectOption('text');
  await visibilityFilter.selectOption('hidden');
  await expect(page.getByRole('status').filter({ hasText: '1件一致 / 全2件' })).toBeVisible();
  await expect(tree.getByRole('treeitem')).toHaveCount(1);
  await expect(tree).toContainText('テキスト 2');

  await visibilityFilter.selectOption('visible');
  await expect(page.getByText('条件に一致するレイヤーはありません')).toBeVisible();

  await page.getByRole('button', { name: '絞り込みを解除' }).click();
  await expect(typeFilter).toHaveValue('all');
  await expect(visibilityFilter).toHaveValue('all');
  await expect(tree.getByRole('treeitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '絞り込みを解除' })).toBeDisabled();
});
