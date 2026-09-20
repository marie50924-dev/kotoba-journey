import { describe, expect, it } from 'vitest';
import {
  isAnswerCorrect,
  isBlankAnswer,
  looksLikeWrongScript,
  normalizeEnglishAnswer,
  normalizeJapaneseAnswer,
} from '../domain/answerCheck';

/**
 * 直接入力テストの正誤判定。
 *
 * 入力方法の都合で生じる差は正解にし、語そのものの差は区別する、という
 * 線引きが守られているかを確かめる。
 */

describe('英語の正規化', () => {
  it('前後の空白を落とす', () => {
    expect(normalizeEnglishAnswer('  apple  ')).toBe('apple');
  });

  it('大文字小文字をそろえる', () => {
    expect(normalizeEnglishAnswer('Apple')).toBe('apple');
    expect(normalizeEnglishAnswer('APPLE')).toBe('apple');
  });

  it('全角英字を半角にする', () => {
    expect(normalizeEnglishAnswer('ａｐｐｌｅ')).toBe('apple');
  });

  it('語中の連続した空白を1つにまとめる', () => {
    expect(normalizeEnglishAnswer('ice   cream')).toBe('ice cream');
    expect(normalizeEnglishAnswer('ice　cream')).toBe('ice cream');
  });
});

describe('英語の正誤判定', () => {
  it('iPhone の自動大文字化で Apple になっても正解', () => {
    expect(isAnswerCorrect('Apple', 'apple', 'en')).toBe(true);
  });

  it('前後に空白が入っても正解', () => {
    expect(isAnswerCorrect(' apple ', 'apple', 'en')).toBe(true);
  });

  it('全角で打っても正解', () => {
    expect(isAnswerCorrect('ａｐｐｌｅ', 'apple', 'en')).toBe(true);
  });

  it('綴りが違えば不正解', () => {
    expect(isAnswerCorrect('aple', 'apple', 'en')).toBe(false);
    expect(isAnswerCorrect('apples', 'apple', 'en')).toBe(false);
  });

  it('空の入力は不正解', () => {
    expect(isAnswerCorrect('', 'apple', 'en')).toBe(false);
    expect(isAnswerCorrect('   ', 'apple', 'en')).toBe(false);
  });
});

describe('日本語の正規化', () => {
  it('カタカナをひらがなへそろえる', () => {
    expect(normalizeJapaneseAnswer('リンゴ')).toBe('りんご');
  });

  it('半角カタカナもひらがなへそろえる', () => {
    expect(normalizeJapaneseAnswer('ﾘﾝｺﾞ')).toBe('りんご');
  });

  it('空白をすべて落とす', () => {
    expect(normalizeJapaneseAnswer(' り ん ご ')).toBe('りんご');
    expect(normalizeJapaneseAnswer('りん　ご')).toBe('りんご');
  });

  it('濁点・促音・長音はそのまま残す', () => {
    expect(normalizeJapaneseAnswer('りんご')).toBe('りんご');
    expect(normalizeJapaneseAnswer('りんこ')).toBe('りんこ');
    expect(normalizeJapaneseAnswer('けーき')).toBe('けーき');
    expect(normalizeJapaneseAnswer('がっこう')).toBe('がっこう');
  });
});

describe('日本語の正誤判定', () => {
  it('ひらがなでもカタカナでも正解', () => {
    expect(isAnswerCorrect('りんご', 'りんご', 'ja')).toBe(true);
    expect(isAnswerCorrect('リンゴ', 'りんご', 'ja')).toBe(true);
    expect(isAnswerCorrect('ﾘﾝｺﾞ', 'りんご', 'ja')).toBe(true);
  });

  it('余分な空白が入っても正解', () => {
    expect(isAnswerCorrect(' りんご ', 'りんご', 'ja')).toBe(true);
  });

  it('濁点の有無は区別する', () => {
    expect(isAnswerCorrect('りんこ', 'りんご', 'ja')).toBe(false);
  });

  it('長音の有無は区別する', () => {
    expect(isAnswerCorrect('けき', 'けーき', 'ja')).toBe(false);
  });

  it('促音の有無は区別する', () => {
    expect(isAnswerCorrect('がこう', 'がっこう', 'ja')).toBe(false);
  });

  it('意味が変わる伸ばしは正解にしない', () => {
    // 「おばさん」と「おばあさん」を同じ扱いにしない。
    expect(isAnswerCorrect('おばさん', 'おばあさん', 'ja')).toBe(false);
  });

  it('空の入力は不正解', () => {
    expect(isAnswerCorrect('', 'りんご', 'ja')).toBe(false);
    expect(isAnswerCorrect('　', 'りんご', 'ja')).toBe(false);
  });
});

describe('未入力の判定', () => {
  it('空白だけなら未入力とみなす', () => {
    expect(isBlankAnswer('')).toBe(true);
    expect(isBlankAnswer('   ')).toBe(true);
    expect(isBlankAnswer('　')).toBe(true);
    expect(isBlankAnswer('a')).toBe(false);
    expect(isBlankAnswer('あ')).toBe(false);
  });
});

describe('キーボードの取り違えの案内', () => {
  it('英語を答える場面でかなが入っていれば案内する', () => {
    expect(looksLikeWrongScript('りんご', 'en')).toBe(true);
    expect(looksLikeWrongScript('apple', 'en')).toBe(false);
  });

  it('ひらがなを答える場面で英字だけなら案内する', () => {
    expect(looksLikeWrongScript('ringo', 'ja')).toBe(true);
    expect(looksLikeWrongScript('りんご', 'ja')).toBe(false);
  });

  it('変換途中のローマ字入力は案内しない', () => {
    // 日本語キーボードでの入力中は、かなと英字が混ざることがある。
    expect(looksLikeWrongScript('りんgo', 'ja')).toBe(false);
  });

  it('空の入力では案内しない', () => {
    expect(looksLikeWrongScript('', 'en')).toBe(false);
    expect(looksLikeWrongScript('  ', 'ja')).toBe(false);
  });

  it('案内は採点に影響しない（判定は別の関数）', () => {
    // 案内が出る入力でも、正規化の結果が一致していれば正解のまま。
    expect(looksLikeWrongScript('ＡＰＰＬＥ', 'en')).toBe(false);
    expect(isAnswerCorrect('ＡＰＰＬＥ', 'apple', 'en')).toBe(true);
  });
});
