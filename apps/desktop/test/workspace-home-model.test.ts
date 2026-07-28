import { describe, expect, it } from 'vitest';
import {
  formatHomeTimestamp,
  sortRecentWorkspaceDocuments,
} from '../src/workspace-home-model';

function documentRecord(
  index: number,
  overrides: Partial<PublicDocumentRecord> = {},
): PublicDocumentRecord {
  return {
    documentId: index.toString(16).padStart(64, '0'),
    displayName: `Workspace ${index.toString().padStart(3, '0')}`,
    favorite: false,
    lastOpenedAt: new Date(Date.UTC(2026, 6, 1, 0, 0, index)).toISOString(),
    lastSavedAt: null,
    ...overrides,
  };
}

describe('workspace home model', () => {
  it('お気に入りを先頭にし、各グループを最終利用日時の降順にする', () => {
    const documents = [
      documentRecord(1),
      documentRecord(2, { favorite: true }),
      documentRecord(3),
      documentRecord(4, { favorite: true }),
    ];

    expect(
      sortRecentWorkspaceDocuments(documents).map((document) => document.displayName),
    ).toEqual([
      'Workspace 004',
      'Workspace 002',
      'Workspace 003',
      'Workspace 001',
    ]);
    expect(documents.map((document) => document.displayName)).toEqual([
      'Workspace 001',
      'Workspace 002',
      'Workspace 003',
      'Workspace 004',
    ]);
  });

  it('100件と不正日時を決定的に整列する', () => {
    const documents = Array.from({ length: 100 }, (_, index) =>
      documentRecord(index + 1, {
        favorite: index % 10 === 0,
        lastOpenedAt: index % 17 === 0 ? 'unknown' : new Date(
          Date.UTC(2026, 6, 1, 0, index, 0),
        ).toISOString(),
      }),
    );

    const sorted = sortRecentWorkspaceDocuments(documents);
    expect(sorted).toHaveLength(100);
    expect(sorted.slice(0, 10).every((document) => document.favorite)).toBe(true);
    expect(new Set(sorted.map((document) => document.documentId)).size).toBe(100);
  });

  it('お気に入り・日時・表示名が同じ場合はdocument IDで整列する', () => {
    const timestamp = '2026-07-27T00:00:00.000Z';
    const documents = [3, 1, 2].map((index) =>
      documentRecord(index, {
        displayName: '同名Workspace',
        favorite: true,
        lastOpenedAt: timestamp,
      }),
    );

    expect(
      sortRecentWorkspaceDocuments(documents).map((document) => document.documentId),
    ).toEqual([
      documentRecord(1).documentId,
      documentRecord(2).documentId,
      documentRecord(3).documentId,
    ]);
  });

  it('不正日時を安全な表示へフォールバックする', () => {
    expect(formatHomeTimestamp('invalid')).toBe('日時不明');
    expect(formatHomeTimestamp('')).toBe('日時不明');
    expect(formatHomeTimestamp('2026-07-27T00:00:00.000Z')).not.toBe('日時不明');
  });
});
