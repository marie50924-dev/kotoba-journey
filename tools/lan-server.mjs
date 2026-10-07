/**
 * スマートフォンから確認するための、同じWi-Fi内だけに配る確認用サーバー。
 *
 * つくったもの（dist/）をそのまま配り、同じWi-Fiにつないだスマホから
 * 開けるアドレスを全部表示する。外へは公開しない。
 *
 *   node tools/lan-server.mjs                 http で配る（既定・ポート 5180）
 *   node tools/lan-server.mjs --https         https で配る（自己署名の証明書を作る）
 *   node tools/lan-server.mjs --port 8080     ポートを変える
 *   node tools/lan-server.mjs --dir dist      配るフォルダーを変える
 *
 * 新しい依存は入れていない。Node に最初から入っているものだけで動く。
 * （--https のときだけ、証明書づくりに openssl を使う。無ければ http のまま続ける）
 *
 * 注意
 *   ・これは開発中の確認用で、公開用のサーバーではない。
 *   ・同じWi-Fi（同じLAN）の中からしか開けない。インターネットには出ない。
 *   ・終わるときは Ctrl+C。
 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, stat, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

/** ビルド後のページが置かれる場所の入口。vite.config.ts の base と同じにする。 */
const BASE_PATH = '/kotoba-journey/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webm': 'video/webm',
  '.map': 'application/json; charset=utf-8',
};

function parseArgs(argv) {
  const out = { https: false, port: 5180, dir: 'dist' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--https') out.https = true;
    else if (arg === '--port') { out.port = Number(argv[i + 1]); i += 1; }
    else if (arg === '--dir') { out.dir = argv[i + 1]; i += 1; }
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

/** 同じWi-Fiの中で使える自分のアドレスを全部あつめる。 */
function lanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family !== 'IPv4' || item.internal) continue;
      found.push({ name, address: item.address });
    }
  }
  return found;
}

/**
 * 自己署名の証明書をつくる（--https のときだけ）。
 * すでにあれば作り直さない。openssl が無ければ null を返して http のまま続ける。
 */
async function ensureCertificate(root) {
  const dir = join(root, '.cert');
  const keyPath = join(dir, 'local-key.pem');
  const certPath = join(dir, 'local-cert.pem');
  if (existsSync(keyPath) && existsSync(certPath)) {
    return { key: await readFile(keyPath), cert: await readFile(certPath) };
  }
  const names = lanAddresses().map((item) => item.address);
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...names.map((ip) => `IP:${ip}`)].join(',');
  try {
    await mkdir(dir, { recursive: true });
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
      '-keyout', keyPath, '-out', certPath,
      '-subj', '/CN=kotoba-journey-local',
      '-addext', `subjectAltName=${san}`,
    ], { stdio: 'ignore' });
    await writeFile(join(dir, 'README.txt'),
      'このフォルダーは確認用の自己署名証明書です。\n'
      + 'スマホで https を試すためだけに作られます。公開には使えません。\n'
      + '消しても、次に --https で起動したときに作り直されます。\n'
      + 'git には入れないでください（.cert/ は追跡対象外にしています）。\n', 'utf8');
    return { key: await readFile(keyPath), cert: await readFile(certPath) };
  } catch {
    // 作れなかったら、空のフォルダーを残さない。
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('node tools/lan-server.mjs [--https] [--port 5180] [--dir dist]');
    return;
  }

  const projectRoot = resolve(new URL('..', import.meta.url).pathname);
  const root = resolve(projectRoot, args.dir);

  // 配るものが無いときは、作り方をそのまま伝えて止める。
  try {
    await stat(join(root, 'index.html'));
  } catch {
    console.error(`${args.dir}/index.html が見つかりません。`);
    console.error('先に次を実行してください：  npm ci && npm run build');
    process.exitCode = 1;
    return;
  }

  const tls = args.https ? await ensureCertificate(projectRoot) : null;
  if (args.https && tls === null) {
    console.warn('openssl が無いため、証明書を作れませんでした。http のまま起動します。');
  }
  const scheme = tls ? 'https' : 'http';

  const handler = async (req, res) => {
    let path = decodeURIComponent((req.url ?? '/').split('?')[0]);

    // 入口を打ちやすくする。/ でも /kotoba-journey でも中へ入れる。
    if (path === '/' || path === '/index.html') {
      res.writeHead(302, { Location: BASE_PATH });
      res.end();
      return;
    }
    if (`${path}/` === BASE_PATH) {
      res.writeHead(302, { Location: BASE_PATH });
      res.end();
      return;
    }
    if (path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length - 1);
    if (path === '/' || path === '') path = '/index.html';

    const file = join(root, normalize(path));
    if (!file.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        // 直したものをスマホで開き直したとき、古いものが残らないようにする。
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      // 画面の中の移動で来た見知らぬ住所は、入口の画面へ戻す。
      if (extname(file) === '') {
        const index = await readFile(join(root, 'index.html'));
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(index);
        return;
      }
      res.writeHead(404).end('not found');
    }
  };

  const server = tls
    ? createHttpsServer({ key: tls.key, cert: tls.cert }, handler)
    : createHttpServer(handler);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`ポート ${args.port} はすでに使われています。`);
      console.error(`別のポートで試してください：  node tools/lan-server.mjs --port ${args.port + 1}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });

  // 0.0.0.0 で待つ。こうしないと、同じWi-Fiのスマホから届かない。
  server.listen(args.port, '0.0.0.0', () => {
    const addresses = lanAddresses();
    console.log('');
    console.log('  ことばトラベル／スマートフォン確認用サーバー');
    console.log(`  配っているもの: ${args.dir}/   方式: ${scheme}`);
    console.log('');
    console.log('  このパソコンで開く');
    console.log(`    ${scheme}://localhost:${args.port}${BASE_PATH}`);
    console.log('');
    if (addresses.length === 0) {
      console.log('  同じWi-Fiのスマホから開く');
      console.log('    ネットワークのアドレスが見つかりませんでした。');
      console.log('    Wi-Fiにつながっているか確認してください。');
    } else {
      console.log('  同じWi-Fiのスマホから開く（スマホのブラウザにこのまま入力）');
      for (const item of addresses) {
        console.log(`    ${scheme}://${item.address}:${args.port}${BASE_PATH}   （${item.name}）`);
      }
    }
    console.log('');
    if (tls) {
      console.log('  https は自己署名の証明書です。');
      console.log('  スマホで「安全ではない」と出たら、詳細を開いて続行してください。');
      console.log('');
    }
    console.log('  終わるときは Ctrl+C');
    console.log('');
  });
}

await main();
