import { expect, test } from '@playwright/test';

test('Projectタブを追加・Undo・切り替え・閉じる・ホーム往復後に復元できる', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();

  await expect(tablist.getByRole('tab')).toHaveCount(2);
  const firstTab = tablist.getByRole('tab', { name: /新しいプロジェクト/ });
  const secondTab = tablist.getByRole('tab', { name: /プロジェクト 2/ });
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('ワークスペースに未保存の変更あり')).toBeVisible();

  await page.getByRole('button', { name: 'Project追加を元に戻す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Project追加をやり直す' })).toBeEnabled();
  await page.getByRole('button', { name: 'Project追加をやり直す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: '新しいプロジェクトのタブを閉じる' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'プロジェクト 2のタブを閉じる' }),
  ).toBeDisabled();

  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'ホーム', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ワークスペースホーム' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '編集を続ける' }).click();

  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '閉じたタブを復元' })).toBeEnabled();
  await page.getByRole('button', { name: '閉じたタブを復元' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.focus();
  await firstTab.press('ArrowRight');
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
});
