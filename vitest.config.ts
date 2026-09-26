import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    /*
     * CSS の取り込みを有効にする。
     * 既定（false）だと CSS は ?raw / ?inline を付けても空文字になるため、
     * ボタンの正式配色を CSS から読み取って検査できない。
     * 画面へ CSS を適用するのは実ブラウザテストの役目で、
     * ここでは文字列として読めるようにするだけ。
     */
    css: true,
  },
});
