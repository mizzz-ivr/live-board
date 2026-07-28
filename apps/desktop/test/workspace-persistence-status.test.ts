import { describe, expect, it } from 'vitest';
import {
  resolveWorkspacePersistenceIdleStatus,
  resolveWorkspacePersistenceSaveCompletion,
} from '../src/workspace-persistence-status';

describe('workspace persistence idle status', () => {
  it('documentがない場合は未保存を返す', () => {
    expect(resolveWorkspacePersistenceIdleStatus({
      hasDocument: false,
      revision: 0,
      lastExplicitSaveRevision: null,
    })).toBe('保存: 未保存');
  });

  it('明示保存revisionと現在revisionが一致する場合は明示保存済みを返す', () => {
    expect(resolveWorkspacePersistenceIdleStatus({
      hasDocument: true,
      revision: 4,
      lastExplicitSaveRevision: 4,
    })).toBe('保存: 明示保存済み');
    expect(resolveWorkspacePersistenceIdleStatus({
      hasDocument: true,
      revision: 0,
      lastExplicitSaveRevision: 0,
    })).toBe('保存: 明示保存済み');
  });

  it('documentがあってもrevisionが進んでいれば変更ありを返す', () => {
    expect(resolveWorkspacePersistenceIdleStatus({
      hasDocument: true,
      revision: 5,
      lastExplicitSaveRevision: 4,
    })).toBe('保存: 変更あり');
    expect(resolveWorkspacePersistenceIdleStatus({
      hasDocument: true,
      revision: 0,
      lastExplicitSaveRevision: null,
    })).toBe('保存: 変更あり');
  });
});

describe('workspace explicit save completion', () => {
  it('保存中に編集がなければ保存対象revisionを明示保存済みとして返す', () => {
    expect(resolveWorkspacePersistenceSaveCompletion({
      currentRevision: 4,
      savedRevision: 4,
    })).toEqual({
      lastExplicitSaveRevision: 4,
      status: '保存: 明示保存済み',
    });
  });

  it('保存中にrevisionが進んだ場合は保存開始時revisionだけを保存済みとして返す', () => {
    expect(resolveWorkspacePersistenceSaveCompletion({
      currentRevision: 5,
      savedRevision: 4,
    })).toEqual({
      lastExplicitSaveRevision: 4,
      status: '保存: 変更あり',
    });
  });
});
