import {cp, mkdtemp, rm, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const build = await mkdtemp(join(tmpdir(), 'khmer-pages-'));
try {
  for (const file of ['src', 'public', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'postcss.config.mjs', 'package.json', 'package-lock.json']) {
    await cp(join(project, file), join(build, file), {recursive: true});
  }
  await rm(join(build, 'src/app/api'), {recursive: true});
  await rm(join(build, 'src/proxy.ts'));
  await symlink(join(project, 'node_modules'), join(build, 'node_modules'), 'dir');
  execFileSync(process.execPath, [join(project, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
    cwd: build,
    env: {
      ...process.env,
      NEXT_PUBLIC_GITHUB_PAGES: '1',
      NEXT_PUBLIC_PAGES_BASE_PATH: process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? '/Khmer-Dub-Studio',
    },
    stdio: 'inherit',
  });
  await rm(join(project, 'pages-out'), {recursive:true, force:true});
  await cp(join(build, 'out'), join(project, 'pages-out'), {recursive:true});
} finally {
  await rm(build, {recursive:true, force:true});
}
