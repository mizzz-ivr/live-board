import { useCallback, useEffect, useState } from 'react';
import type { Page, ProjectAssetLibrary } from '@live-board/domain';
import {
  createUserPageTemplate,
  deleteUserPageTemplate,
  loadUserPageTemplates,
  restoreLastDeletedUserPageTemplate,
  saveUserPageTemplate,
  type UserPageTemplate,
  type UserPageTemplateStorage,
} from './user-page-templates';
import {
  collectUserPageTemplateAssetReferenceIds,
  collectUserPageTemplateAssets,
  garbageCollectUserPageTemplateAssetPayloads,
  persistUserPageTemplateAssetPayloads,
} from './user-page-template-assets';
import { getBrowserUserPageTemplateAssetPayloadStore } from './user-page-template-asset-payload-store';

export interface UserPageTemplateController {
  readonly enabled: boolean;
  readonly templates: readonly UserPageTemplate[];
  readonly message: string | null;
  readonly canRestoreDeleted: boolean;
  savePage(page: Page, name: string, assetLibrary: ProjectAssetLibrary): Promise<boolean>;
  removeTemplate(templateId: string): Promise<boolean>;
  restoreDeletedTemplate(): Promise<boolean>;
}

interface UserPageTemplateState {
  readonly enabled: boolean;
  readonly templates: UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
  readonly message: string | null;
}

export function useUserPageTemplates(): UserPageTemplateController {
  const [state, setState] = useState<UserPageTemplateState>(loadInitialState);

  useEffect(() => {
    const initial = loadInitialState();
    if (!initial.enabled) return;
    void garbageCollectResult({
      templates: initial.templates,
      lastDeletedTemplate: initial.lastDeletedTemplate,
    }).catch(() => undefined);
  }, []);

  const savePage = useCallback(async (
    page: Page,
    name: string,
    assetLibrary: ProjectAssetLibrary,
  ): Promise<boolean> => {
    try {
      const storage = browserStorage();
      const createdAt = new Date().toISOString();
      const template = createUserPageTemplate({
        templateId: `user-template:${globalThis.crypto.randomUUID()}`,
        name,
        page,
        assetLibrary,
        createdAt,
      });
      const sourceAssets = collectUserPageTemplateAssets(page, assetLibrary);
      await persistUserPageTemplateAssetPayloads(
        sourceAssets,
        getBrowserUserPageTemplateAssetPayloadStore(),
      );
      let result;
      try {
        result = saveUserPageTemplate(storage, template);
      } catch (error: unknown) {
        await garbageCollectCurrentStoreBestEffort();
        throw error;
      }
      const gcWarning = await garbageCollectResult(result).catch(() =>
        '不要なAssetバイナリの整理に失敗しました。',
      );
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: [
          `「${template.name}」をマイテンプレートへ保存しました。`,
          ...result.warnings,
          ...(gcWarning === undefined ? [] : [gcWarning]),
        ].join(' '),
      });
      return true;
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        message: errorMessage(error, 'マイテンプレートの保存に失敗しました。'),
      }));
      return false;
    }
  }, []);

  const removeTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    try {
      const storage = browserStorage();
      const result = deleteUserPageTemplate(storage, templateId);
      const gcWarning = await garbageCollectResult(result).catch(() =>
        '不要なAssetバイナリの整理に失敗しました。',
      );
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: [
          'マイテンプレートを削除しました。',
          ...result.warnings,
          ...(gcWarning === undefined ? [] : [gcWarning]),
        ].join(' '),
      });
      return true;
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        message: errorMessage(error, 'マイテンプレートの削除に失敗しました。'),
      }));
      return false;
    }
  }, []);

  const restoreDeletedTemplate = useCallback(async (): Promise<boolean> => {
    try {
      const result = restoreLastDeletedUserPageTemplate(browserStorage());
      const gcWarning = await garbageCollectResult(result).catch(() =>
        '不要なAssetバイナリの整理に失敗しました。',
      );
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: [
          '削除したマイテンプレートを復元しました。',
          ...result.warnings,
          ...(gcWarning === undefined ? [] : [gcWarning]),
        ].join(' '),
      });
      return true;
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        message: errorMessage(error, 'マイテンプレートの復元に失敗しました。'),
      }));
      return false;
    }
  }, []);

  return {
    enabled: state.enabled,
    templates: state.templates,
    message: state.message,
    canRestoreDeleted: state.lastDeletedTemplate !== null,
    savePage,
    removeTemplate,
    restoreDeletedTemplate,
  };
}

function loadInitialState(): UserPageTemplateState {
  try {
    const result = loadUserPageTemplates(browserStorage());
    return {
      enabled: true,
      templates: result.templates,
      lastDeletedTemplate: result.lastDeletedTemplate,
      message: result.warnings.length === 0 ? null : result.warnings.join(' '),
    };
  } catch (error: unknown) {
    return {
      enabled: false,
      templates: [],
      lastDeletedTemplate: null,
      message: errorMessage(error, 'マイテンプレート保存領域を利用できません。'),
    };
  }
}

function browserStorage(): UserPageTemplateStorage {
  if (typeof window === 'undefined') {
    throw new Error('Browser storage is unavailable');
  }
  return window.localStorage;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function garbageCollectResult(result: {
  readonly templates: readonly UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
}): Promise<void> {
  const referenced = collectUserPageTemplateAssetReferenceIds([
    ...result.templates,
    ...(result.lastDeletedTemplate === null ? [] : [result.lastDeletedTemplate]),
  ]);
  await garbageCollectUserPageTemplateAssetPayloads(
    getBrowserUserPageTemplateAssetPayloadStore(),
    referenced,
  );
}

async function garbageCollectCurrentStoreBestEffort(): Promise<void> {
  try {
    const current = loadUserPageTemplates(browserStorage());
    await garbageCollectResult(current);
  } catch {
    // 将来schemaやストレージ障害時は未知の参照を消さない。
  }
}
