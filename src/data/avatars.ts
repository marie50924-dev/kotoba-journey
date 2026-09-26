/**
 * 80人の正式キャラクター名簿。
 *
 * 唯一の正本は src/data/kotoba-journey-character-names-v1.json（受領ファイルを無改変で取り込み）。
 * TypeScript 側へ名前を書き写すことはせず、必ずこの JSON を import して組み立てる。
 * 名簿を更新するときは JSON だけを差し替えればよい。
 *
 * 画像について:
 *   本番用の個別透過立ち絵は未納品。imageKey は全員 null で、
 *   画面には components/avatarThumb.ts が描く「仮サムネイル」（年代色＋イニシャル＋名前）が出る。
 *   立ち絵が納品されたら、imageKey を設定して avatarThumb.ts の1箇所を差し替えるだけで移行できる。
 *   コンセプトシートの切り抜きは本番素材として使わない。
 */

import rosterJson from './kotoba-journey-character-names-v1.json';

export type AvatarAgeGroup = 'elementary' | 'middle' | 'high' | 'university' | 'adult';

/** 見た目の分類。学習内容には一切影響しない。 */
export type AvatarPresentation = 'm' | 'f';

export interface AvatarDefinition {
  id: string;
  ageGroup: AvatarAgeGroup;
  presentation: AvatarPresentation;
  /** コンセプトシートの並び順（各年代・各分類の中で 1〜8）。 */
  order: number;
  familyName: string;
  givenName: string;
  familyNameKana: string;
  givenNameKana: string;
  romanizedName: string;
  /** 本番立ち絵のキー。未納品のため現時点では全員 null。 */
  imageKey: string | null;
  enabled: boolean;
}

/** JSON の生の1件。imageKey / enabled は JSON 側に無いのでここで補う。 */
interface RosterEntry {
  id: string;
  ageGroup: string;
  presentation: string;
  order: number;
  familyName: string;
  givenName: string;
  familyNameKana: string;
  givenNameKana: string;
  romanizedName: string;
}

interface RosterFile {
  version: number;
  ordering: string;
  displayRule: string;
  characters: RosterEntry[];
}

export const AVATAR_AGE_GROUPS: readonly AvatarAgeGroup[] = [
  'elementary',
  'middle',
  'high',
  'university',
  'adult',
];

export const AGE_GROUP_LABEL: Record<AvatarAgeGroup, string> = {
  elementary: '小学生',
  middle: '中学生',
  high: '高校生',
  university: '大学生',
  adult: '大人',
};

/** 仮サムネイルの年代色。色だけに頼らず、必ず名前やイニシャルと併記する。 */
export const AGE_GROUP_COLOR: Record<AvatarAgeGroup, string> = {
  elementary: '#e2703a',
  middle: '#2f8f6b',
  high: '#2f6f9e',
  university: '#8a5cc0',
  adult: '#b3543f',
};

export const PRESENTATION_LABEL: Record<AvatarPresentation, string> = {
  m: '男性',
  f: '女性',
};

/**
 * imageKey として許す形。
 *
 * imageKey は「拡張子を含まない安全なキー」として扱う。ファイル名そのものや
 * パスを入れられるようにすると、`../` や別ディレクトリを指す値が紛れ込んだときに
 * そのまま URL へ入ってしまう。そこで小文字英数字とハイフンだけに限り、
 * 先頭と末尾をハイフンにしない形だけを通す。
 *
 * 通す例   : 'elementary-m'  'adult-f-03'
 * 通さない例: 'elementary-m.webp'（拡張子）
 *             '../secret'（パス）
 *             'assets/avatars/x'（ディレクトリ）
 *             'Elementary-M'（大文字）
 *             ''（空）
 */
const IMAGE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSafeImageKey(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_KEY_PATTERN.test(value);
}

/** Vite の base を反映した URL を作る。GitHub Pages のサブパス公開に対応する。 */
function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/**
 * 主人公の画像URL。
 *
 * imageKey が未設定（納品前）のときと、安全でないキーが入っているときは null を返す。
 * null のときは画面側が仮サムネイルを出す。拡張子 .webp はここだけで付ける。
 */
export function avatarImageUrl(avatar: Pick<AvatarDefinition, 'imageKey'>): string | null {
  if (!isSafeImageKey(avatar.imageKey)) return null;
  return assetUrl(`assets/avatars/${avatar.imageKey}.webp`);
}

function isAgeGroupValue(value: string): value is AvatarAgeGroup {
  return (AVATAR_AGE_GROUPS as readonly string[]).includes(value);
}

function isPresentationValue(value: string): value is AvatarPresentation {
  return value === 'm' || value === 'f';
}

/** JSON を型付きの名簿へ変換する。想定外の年代・分類が混ざっていれば読み込み時点で落とす。 */
function buildRoster(file: RosterFile): AvatarDefinition[] {
  return file.characters.map((entry) => {
    if (!isAgeGroupValue(entry.ageGroup)) {
      throw new Error(`未知の年代です: ${entry.id} / ${entry.ageGroup}`);
    }
    if (!isPresentationValue(entry.presentation)) {
      throw new Error(`未知の分類です: ${entry.id} / ${entry.presentation}`);
    }
    return {
      id: entry.id,
      ageGroup: entry.ageGroup,
      presentation: entry.presentation,
      order: entry.order,
      familyName: entry.familyName,
      givenName: entry.givenName,
      familyNameKana: entry.familyNameKana,
      givenNameKana: entry.givenNameKana,
      romanizedName: entry.romanizedName,
      // 本番立ち絵は未納品。納品後にここへキーを入れる。
      imageKey: null,
      enabled: true,
    };
  });
}

export const AVATARS: readonly AvatarDefinition[] = buildRoster(rosterJson as RosterFile);

/** 名簿の版。保存データの移行判断に使えるよう公開しておく。 */
export const ROSTER_VERSION: number = (rosterJson as RosterFile).version;

const AVATAR_BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export function findAvatar(id: string | null | undefined): AvatarDefinition | undefined {
  if (!id) return undefined;
  return AVATAR_BY_ID.get(id);
}

/** 削除済み・無効なIDを弾く。保存データの復旧に使う。 */
export function isValidAvatarId(id: unknown): id is string {
  return typeof id === 'string' && (AVATAR_BY_ID.get(id)?.enabled ?? false);
}

/** 選択肢として出せるキャラクター。 */
export function enabledAvatars(): AvatarDefinition[] {
  return AVATARS.filter((a) => a.enabled);
}

export function avatarsByAgeGroup(ageGroup: AvatarAgeGroup): AvatarDefinition[] {
  return AVATARS.filter((a) => a.ageGroup === ageGroup && a.enabled);
}

/**
 * 会話で使う一人称。
 *
 * 台本は80人共通のテンプレートなので、そのままだと全員が同じ一人称で話してしまう。
 * 名簿の年代と表示分類から引いて、台本側の {npcI} / {meI} へ差し込む。
 *
 * 表記は学習アプリとして落ち着いた言葉づかいに寄せ、
 * 乱暴に聞こえる言い方は使わない。
 * 個別台本を作る工程になったら、この表より台本側の指定を優先させる。
 */
const FIRST_PERSON: Record<AvatarAgeGroup, Record<AvatarPresentation, string>> = {
  elementary: { m: 'ぼく', f: 'わたし' },
  middle: { m: 'ぼく', f: 'わたし' },
  high: { m: 'ぼく', f: 'わたし' },
  university: { m: 'ぼく', f: 'わたし' },
  adult: { m: 'わたし', f: 'わたし' },
};

export function firstPerson(avatar: AvatarDefinition): string {
  return FIRST_PERSON[avatar.ageGroup][avatar.presentation];
}

/** 会話では下の名前を使う。 */
export function displayName(avatar: AvatarDefinition): string {
  return avatar.givenName;
}

/** プロフィールでは姓名を使う。 */
export function fullName(avatar: AvatarDefinition): string {
  return `${avatar.familyName}${avatar.givenName}`;
}

export function fullNameKana(avatar: AvatarDefinition): string {
  return `${avatar.familyNameKana} ${avatar.givenNameKana}`;
}
