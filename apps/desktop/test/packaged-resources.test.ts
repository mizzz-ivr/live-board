import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parsePackagedSmokeArguments,
  resolvePackagedResourcePaths,
} from '../electron/packaged-resources.js';

describe('packaged resources', () => {
  it('RendererとOverlayの配置先を分離して解決する', () => {
    expect(resolvePackagedResourcePaths('/resources/app.asar/dist-electron', '/resources')).toEqual({
      rendererIndex: join('/resources/app.asar/dist-electron', '../dist/index.html'),
      overlayRoot: join('/resources', 'overlay', 'dist'),
      overlayIndex: join('/resources', 'overlay', 'dist', 'index.html'),
    });
  });

  it('smoke testは既定1回として出力先を解析する', () => {
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-output=C:/temp/result.json',
    ])).toEqual({
      enabled: true,
      outputPath: 'C:/temp/result.json',
      iterations: 1,
    });
  });

  it('smoke testの反復回数を1〜500回で受理する', () => {
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-iterations=100',
    ])).toEqual({
      enabled: true,
      outputPath: undefined,
      iterations: 100,
    });
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-iterations=500',
    ]).iterations).toBe(500);
  });

  it.each(['0', '-1', '1.5', 'text', '501', '', '001'])(
    '不正な反復回数 %s を拒否する',
    (value) => {
      expect(() => parsePackagedSmokeArguments([
        'LiveBoard.exe',
        '--smoke-test',
        `--smoke-iterations=${value}`,
      ])).toThrow('PACKAGED_SMOKE_ITERATIONS_INVALID');
    },
  );

  it('smoke testなしの出力指定と反復回数指定を拒否する', () => {
    expect(() => parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-output=C:/temp/result.json',
    ])).toThrow('PACKAGED_SMOKE_OUTPUT_WITHOUT_TEST');
    expect(() => parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-iterations=2',
    ])).toThrow('PACKAGED_SMOKE_ITERATIONS_WITHOUT_TEST');
  });

  it('出力先と反復回数の重複指定を拒否する', () => {
    expect(() => parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-output=a.json',
      '--smoke-output=b.json',
    ])).toThrow('PACKAGED_SMOKE_OUTPUT_DUPLICATED');
    expect(() => parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-iterations=2',
      '--smoke-iterations=3',
    ])).toThrow('PACKAGED_SMOKE_ITERATIONS_DUPLICATED');
  });

  it('空のリソースパスを拒否する', () => {
    expect(() => resolvePackagedResourcePaths('', '/resources')).toThrow(
      'PACKAGED_RESOURCE_PATH_REQUIRED',
    );
  });
});
