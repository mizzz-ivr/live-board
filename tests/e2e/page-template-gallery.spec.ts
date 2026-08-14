import { expect, test } from '@playwright/test';

test('Pageパネルからテンプレートを作成し、Undo/Redoできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(1);

  const templateButton = page.getByRole('button', {
    name: 'Pageテンプレートを開く',
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
  await search.fill('my template 保存');
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

test('現在Pageをマイテンプレートへ保存し、再読込後に再利用・削除できる', async ({
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
  const nameInput = dialog.getByRole('textbox', { name: 'マイテンプレート名' });
  await nameInput.fill('待機カスタム');
  await dialog.getByRole('button', {
    name: '現在のPageをマイテンプレートに保存',
  }).click();
  await expect(dialog.getByRole('status')).toContainText(
    '「待機カスタム」をマイテンプレートへ保存しました。',
  );
  await expect(
    dialog.getByRole('button', {
      name: '待機カスタムマイテンプレートでPageを作成',
    }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  const reloadedTemplateButton = page.getByRole('button', {
    name: 'Pageテンプレートを開く',
  });
  await reloadedTemplateButton.click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  const savedTemplate = dialog.getByRole('button', {
    name: '待機カスタムマイテンプレートでPageを作成',
  });
  await expect(savedTemplate).toBeVisible();
  await savedTemplate.click();

  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);
  await expect(pageRows.nth(1)).toContainText('待機カスタム');
  const layerTree = page.getByRole('tree', { name: 'レイヤーツリー' });
  await expect(layerTree.getByRole('treeitem')).toHaveCount(6);
  await expect(layerTree).toContainText('メインタイトル');

  await reloadedTemplateButton.click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toContain('待機カスタム');
    await confirmDialog.accept();
  });
  await dialog.getByRole('button', {
    name: '待機カスタムマイテンプレートを削除',
  }).click();
  await expect(
    dialog.getByRole('button', {
      name: '待機カスタムマイテンプレートでPageを作成',
    }),
  ).toHaveCount(0);
  await expect(dialog.getByText('まだマイテンプレートはありません。')).toBeVisible();
  const restoreButton = dialog.getByRole('button', { name: '削除を元に戻す' });
  await expect(restoreButton).toBeEnabled();

  await page.reload();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', { name: '削除を元に戻す' }).click();
  await expect(
    dialog.getByRole('button', {
      name: '待機カスタムマイテンプレートでPageを作成',
    }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: '削除を元に戻す' })).toBeDisabled();
});

test('Asset付きPageをマイテンプレートへ保存し、再利用時にAssetを重複排除する', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7qkAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByLabel('画像ファイルを選択').setInputFiles({
    name: 'template-logo.png',
    mimeType: 'image/png',
    buffer: png,
  });
  const assetRows = page.locator('.asset-list .asset-row');
  await expect(assetRows).toHaveCount(1);
  await expect(assetRows.first()).toContainText('template-logo.png');

  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  let dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('textbox', { name: 'マイテンプレート名' }).fill('ロゴ付きシーン');
  await dialog.getByRole('button', {
    name: '現在のPageをマイテンプレートに保存',
  }).click();
  await expect(dialog.getByRole('status')).toContainText('ロゴ付きシーン');
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
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await expect(assetRows).toHaveCount(0);

  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', {
    name: 'ロゴ付きシーンマイテンプレートでPageを作成',
  }).click();
  await expect(assetRows).toHaveCount(1);
  await expect(assetRows.first()).toContainText('template-logo.png');

  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);
  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', {
    name: 'ロゴ付きシーンマイテンプレートでPageを作成',
  }).click();
  await expect(pageRows).toHaveCount(3);
  await expect(assetRows).toHaveCount(1);
});
