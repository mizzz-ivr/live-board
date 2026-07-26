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

  it('smoke test・出力先・反復回数を解析する', () => {
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-output=C:/temp/result.json',
      '--smoke-iterations=100',
    ])).toEqual({
      enabled: true,
      outputPath: 'C:/temp/result.json',
      iterations: 100,
    });
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
    ])).toEqual({
      enabled: true,
      outputPath: undefined,
      iterations: 1,
    });
  });

  it('反復回数の境界値1と500を受理する', () => {
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-iterations=1',
    ]).iterations).toBe(1);
    expect(parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-test',
      '--smoke-iterations=500',
    ]).iterations).toBe(500);
  });

  it.each(['0', '-1', '1.5', 'abc', '501', '01', ''])(
    '不正な反復回数%sを拒否する',
    (value) => {
      expect(() => parsePackagedSmokeArguments([
        'LiveBoard.exe',
        '--smoke-test',
        `--smoke-iterations=${value}`,
      ])).toThrow('PACKAGED_SMOKE_ITERATIONS_INVALID');
    },
  );

  it('smoke testなしの付随指定と重複指定を拒否する', () => {
    expect(() => parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-output=C:/temp/result.json',
    ])).toThrow('PACKAGED_SMOKE_OUTPUT_WITHOUT_TEST');
    expect(() => parsePackagedSmokeArguments([
      'LiveBoard.exe',
      '--smoke-iterations=2',
    ])).toThrow('PACKAGED_SMOKE_ITERATIONS_WITHOUT_TEST');
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
