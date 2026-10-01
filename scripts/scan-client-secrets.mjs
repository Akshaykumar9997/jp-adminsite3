import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const root = resolve(import.meta.dirname, '..'),
  failures = []
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
      continue
    }
    if (
      !['.js', '.ts', '.tsx', '.html', '.json', '.css', '.map'].includes(
        extname(path),
      )
    )
      continue
    const source = await readFile(path, 'utf8')
    if (
      /sb_secret_[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]+@/.test(
        source,
      )
    )
      failures.push(path)
    for (const match of source.matchAll(
      /eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g,
    )) {
      try {
        if (
          JSON.parse(Buffer.from(match[1], 'base64url').toString()).role ===
          'service_role'
        )
          failures.push(path)
      } catch {}
    }
  }
}
for (const directory of ['src', 'dist', '../jpdemo/dist'])
  await scan(resolve(root, directory))
if (failures.length) {
  console.error('FAIL privileged credential pattern in:', ...new Set(failures))
  process.exitCode = 1
} else
  console.log(
    'PASS client source and both built sites: no service-role JWT, secret key, private key or embedded database password patterns',
  )
