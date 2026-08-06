import { expect, test } from '@playwright/test';

test('コマンドパレットで閉じたProjectを検索して開き、主要操作を実行できる', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  await page.getByRole('button', {
    name: '新しいプロジェクトのタブを閉じる',
  }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Projectコマンド' });
  const search = dialog.getByRole('combobox', { name: 'コマンドを検索' });
  await expect(dialog).toBeVisible();
  await expect(search).toBeFocused();

  await search.fill('新しい');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');

  const reopenedTab = tablist.getByRole('tab', { name: /新しいプロジェクト/ });
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(reopenedTab).toHaveAttribute('aria-selected', 'true');

  const commandButton = page.getByRole('button', {
    name: 'コマンドパレットを表示',
  });
  await commandButton.click();
  await search.fill('project 複製');
  await page.keyboard.press('Enter');
  await expect(tablist.getByRole('tab')).toHaveCount(3);

  await commandButton.click();
  await search.fill('名前 変更');
  page.once('dialog', async (prompt) => prompt.accept('コマンド操作Project'));
  await page.keyboard.press('Enter');
  await expect(
    tablist.getByRole('tab', { name: /コマンド操作Project/ }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('キーボード選択・無効候補・フォーカス復帰・背面ショートカット抑止を維持する', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  const commandButton = page.getByRole('button', {
    name: 'コマンドパレットを表示',
  });

  await commandButton.click();
  const dialog = page.getByRole('dialog', { name: 'Projectコマンド' });
  const search = dialog.getByRole('combobox', { name: 'コマンドを検索' });
  await search.fill('ピン留め');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'プロジェクト 2のタブをピン留め解除' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await commandButton.click();
  await search.fill('タブ 閉じる');
  const closeOption = dialog.getByRole('option', {
    name: /アクティブタブを閉じる/,
  });
  await expect(closeOption).toHaveAttribute('aria-disabled', 'true');

  const tabCount = await tablist.getByRole('tab').count();
  await page.keyboard.press('Control+W');
  await expect(dialog).toBeVisible();
  await expect(tablist.getByRole('tab')).toHaveCount(tabCount);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(commandButton).toBeFocused();

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.dataset.testid = 'command-palette-editable';
    document.body.append(input);
  });
  const editable = page.getByTestId('command-palette-editable');
  await editable.focus();
  await editable.press('Control+K');
  await expect(dialog).toBeHidden();

  await commandButton.click();
  await search.fill('存在しないコマンド');
  await expect(
    dialog.getByText('一致するProjectまたはコマンドがありません。'),
  ).toBeVisible();
});
