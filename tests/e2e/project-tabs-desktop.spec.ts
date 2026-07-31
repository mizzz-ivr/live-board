import { expect, test, type Locator, type Page } from '@playwright/test';

async function dragTabBefore(page: Page, source: Locator, target: Locator): Promise<void> {
  const targetBounds = await target.boundingBox();
  if (targetBounds === null) throw new Error('ドラッグ先のタブ領域を取得できません');

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const eventInit = {
    dataTransfer,
    clientX: targetBounds.x + 1,
    clientY: targetBounds.y + targetBounds.height / 2,
  };
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', eventInit);
  await target.dispatchEvent('drop', eventInit);
  await source.dispatchEvent('dragend', { dataTransfer });
}

test('Projectタブを追加・Project操作Undo・切り替え・閉じる・ホーム往復後に復元できる', async ({
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

  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Project操作をやり直す' })).toBeEnabled();
  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();
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

test('Projectタブをピン留めし、キーボードとドラッグで並び替えられる', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(3);

  const firstTab = tablist.getByRole('tab', { name: /新しいプロジェクト/ });
  const secondTab = tablist.getByRole('tab', { name: /プロジェクト 2/ });
  const thirdTab = tablist.getByRole('tab', { name: /プロジェクト 3/ });

  await page.getByRole('button', { name: 'プロジェクト 3のタブをピン留め' }).click();
  await expect(tablist.getByRole('tab').nth(0)).toContainText('プロジェクト 3');
  await expect(
    page.getByRole('button', { name: 'プロジェクト 3のタブを閉じる' }),
  ).toBeDisabled();

  await secondTab.click();
  await secondTab.press('Control+Shift+ArrowLeft');
  await expect(tablist.getByRole('tab').nth(1)).toContainText('プロジェクト 2');
  await expect(tablist.getByRole('tab').nth(2)).toContainText('新しいプロジェクト');

  await dragTabBefore(page, firstTab, secondTab.locator('..'));
  await expect(tablist.getByRole('tab').nth(1)).toContainText('新しいプロジェクト');
  await expect(tablist.getByRole('tab').nth(2)).toContainText('プロジェクト 2');

  await dragTabBefore(page, secondTab, thirdTab.locator('..'));
  await expect(tablist.getByRole('tab').nth(0)).toContainText('プロジェクト 3');
  await expect(tablist.getByRole('tab').nth(1)).toContainText('新しいプロジェクト');
  await expect(tablist.getByRole('tab').nth(2)).toContainText('プロジェクト 2');

  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'ホーム', exact: true }).click();
  await page.getByRole('button', { name: '編集を続ける' }).click();
  await expect(tablist.getByRole('tab').nth(0)).toContainText('プロジェクト 3');
  await expect(
    page.getByRole('button', { name: 'プロジェクト 3のタブをピン留め解除' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('Projectを複製し、Page構成とProject操作Undo・Redoを維持できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'ページを追加' }).click();
  await expect(page.locator('.page-list .page-row')).toHaveCount(2);

  await page.getByRole('button', { name: '新しいプロジェクトを複製' }).click();

  const duplicatedTab = tablist.getByRole('tab', {
    name: /新しいプロジェクト のコピー/,
  });
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(duplicatedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.page-list .page-row')).toHaveCount(2);
  await expect(page.getByText('ワークスペースに未保存の変更あり')).toBeVisible();

  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(
    tablist.getByRole('tab', { name: /新しいプロジェクト/ }),
  ).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(duplicatedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.page-list .page-row')).toHaveCount(2);
});

test('Project削除を確認し、Undo・Redoで復元できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  page.once('dialog', async (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'プロジェクト 2を削除' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'プロジェクト 2を削除' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(
    tablist.getByRole('tab', { name: /新しいプロジェクト/ }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('button', { name: '新しいプロジェクトを削除' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();
  const restoredTab = tablist.getByRole('tab', { name: /プロジェクト 2/ });
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(restoredTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(
    tablist.getByRole('tab', { name: /新しいプロジェクト/ }),
  ).toHaveAttribute('aria-selected', 'true');
});


test('Project名を変更し、Project操作でUndo・Redoできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  const originalTab = tablist.getByRole('tab', { name: /新しいプロジェクト/ });
  await expect(originalTab).toHaveAttribute('aria-selected', 'true');

  page.once('dialog', async (dialog) => dialog.accept('  配信用ボード  '));
  await page.getByRole('button', { name: '新しいプロジェクトの名前を変更' }).click();

  const renamedTab = tablist.getByRole('tab', { name: /配信用ボード/ });
  await expect(renamedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('ワークスペースに未保存の変更あり')).toBeVisible();

  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();
  await expect(tablist.getByRole('tab', { name: /新しいプロジェクト/ })).toBeVisible();

  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();
  await expect(renamedTab).toBeVisible();
  await expect(renamedTab).toHaveAttribute('aria-selected', 'true');
});
