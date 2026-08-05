import { expect, test } from '@playwright/test';

test('ショートカット一覧をボタンと?キーから開閉し、フォーカスを管理できる', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  const helpButton = page.getByRole('button', {
    name: 'キーボードショートカットを表示',
  });
  const dialog = page.getByRole('dialog', { name: 'キーボードショートカット' });
  const closeButton = page.getByRole('button', {
    name: 'キーボードショートカット一覧を閉じる',
  });

  await helpButton.click();
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(dialog.getByText('アクティブタブを閉じる')).toBeVisible();
  await expect(dialog.getByText('タブを左右へ並び替え')).toBeVisible();

  await page.keyboard.press('Control+W');
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(dialog).toBeVisible();

  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Tab');
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest('dialog') !== null),
      )
      .toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(helpButton).toBeFocused();

  await page.keyboard.press('Shift+/');
  await expect(dialog).toBeVisible();

  await dialog.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(dialog).not.toBeVisible();

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.dataset.testid = 'shortcut-help-editable';
    document.body.append(input);
  });
  const input = page.getByTestId('shortcut-help-editable');
  await input.focus();
  await page.keyboard.press('Shift+/');
  await expect(dialog).not.toBeVisible();
});
