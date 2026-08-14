import { useCallback, useState } from 'react';
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

export interface UserPageTemplateController {
  readonly enabled: boolean;
  readonly templates: readonly UserPageTemplate[];
  readonly message: string | null;
  readonly canRestoreDeleted: boolean;
  savePage(page: Page, name: string, assetLibrary: ProjectAssetLibrary): boolean;
  removeTemplate(templateId: string): boolean;
  restoreDeletedTemplate(): boolean;
}

interface UserPageTemplateState {
  readonly enabled: boolean;
  readonly templates: UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
  readonly message: string | null;
}

export function useUserPageTemplates(): UserPageTemplateController {
  const [state, setState] = useState<UserPageTemplateState>(loadInitialState);

  const savePage = useCallback((
    page: Page,
    name: string,
    assetLibrary: ProjectAssetLibrary,
  ): boolean => {
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
      const result = saveUserPageTemplate(storage, template);
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0
          ? `「${template.name}」を保存しました。${result.warnings.join(' ')}`
          : `「${template.name}」をマイテンプレートへ保存しました。`,
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

  const removeTemplate = useCallback((templateId: string): boolean => {
    try {
      const storage = browserStorage();
      const result = deleteUserPageTemplate(storage, templateId);
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0
          ? `マイテンプレートを削除しました。${result.warnings.join(' ')}`
          : 'マイテンプレートを削除しました。',
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

  const restoreDeletedTemplate = useCallback((): boolean => {
    try {
      const result = restoreLastDeletedUserPageTemplate(browserStorage());
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0
          ? `削除したマイテンプレートを復元しました。${result.warnings.join(' ')}`
          : '削除したマイテンプレートを復元しました。',
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
