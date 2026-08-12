import { expect, test } from '@playwright/test';

test('Pageパネルからテンプレートを作成し、Undo/Redoできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(1);

  const templateButton = page.getByRole('button', {
    name: 'テンプレートからページを追加',
  });
  await templateButton.click();

  const dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', {
      name: 'オープニングテンプレートでPageを作成',
    }),
  ).toBeFocused();
  await expect(
    dialog.getByRole('button', {
      name: '配信開始待機テンプレートでPageを作成',
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', {
      name: '雑談テンプレートでPageを作成',
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', {
      name: '休憩テンプレートでPageを作成',
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', {
      name: 'エンディングテンプレートでPageを作成',
    }),
  ).toBeVisible();

  await dialog.getByRole('button', {
    name: '配信開始待機テンプレートでPageを作成',
  }).click();

  await expect(dialog).toBeHidden();
  await expect(pageRows).toHaveCount(2);
  await expect(pageRows.nth(1)).toContainText('配信開始待機');
  await expect(pageRows.nth(1)).toHaveAttribute('aria-pressed', 'true');

  const layerTree = page.getByRole('tree', { name: 'レイヤーツリー' });
  await expect(layerTree.getByRole('treeitem')).toHaveCount(6);
  await expect(layerTree).toContainText('背景');
  await expect(layerTree).toContainText('メインタイトル');
  await expect(layerTree).toContainText('アクセントライン');

  await page.getByRole('button', { name: 'Pageを元に戻す' }).click();
  await expect(pageRows).toHaveCount(1);

  await page.getByRole('button', { name: 'Pageをやり直す' }).click();
  await expect(pageRows).toHaveCount(2);
  await expect(pageRows.nth(1)).toContainText('配信開始待機');
  await expect(layerTree).toContainText('メインタイトル');
});

test('コマンドパレットからギャラリーを開き、背面ショートカットを抑止する', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  await page.keyboard.press('Control+K');
  const commandDialog = page.getByRole('dialog', { name: 'Project / Pageコマンド' });
  const search = commandDialog.getByRole('combobox', { name: 'コマンドを検索' });
  await search.fill('template');
  await expect(
    commandDialog.getByRole('option', { name: /テンプレートからPageを作成/ }),
  ).toBeVisible();
  await page.keyboard.press('Enter');

  const templateDialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await expect(commandDialog).toBeHidden();
  await expect(templateDialog).toBeVisible();

  await page.keyboard.press('Control+W');
  await expect(templateDialog).toBeVisible();
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(templateDialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'コマンドパレットを表示' }),
  ).toBeFocused();
});
