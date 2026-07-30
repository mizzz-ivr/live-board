import { describe, expect, it } from 'vitest';
import { createProjectAssetLibrary } from '@live-board/domain';
import { retainProjectAssetLibraries } from '../src/workspace-session-assets';

describe('workspace session assets', () => {
  it('現在またはRedo可能なProjectのLibraryを保持する', () => {
    const libraries = {
      p1: createProjectAssetLibrary(),
      p2: createProjectAssetLibrary(),
    };
    expect(retainProjectAssetLibraries(libraries, ['p1', 'p2'])).toBe(libraries);
  });

  it('復元不能になったProjectのLibraryを回収する', () => {
    const libraries = {
      p1: createProjectAssetLibrary(),
      p2: createProjectAssetLibrary(),
    };
    const next = retainProjectAssetLibraries(libraries, ['p1']);
    expect(Object.keys(next)).toEqual(['p1']);
    expect(Object.keys(libraries)).toEqual(['p1', 'p2']);
  });
});
