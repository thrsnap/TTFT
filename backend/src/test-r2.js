import 'dotenv/config'

import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { HeadObjectCommand } from '@aws-sdk/client-s3'

import {
  getR2,
  getR2Bucket,
  uploadR2File,
} from './config/r2.js'

const key = `diagnostics/${randomUUID()}.txt`
const temporaryFile = join(tmpdir(), randomUUID())
const contents = Buffer.from('CMM R2 connection test')

try {
  await writeFile(temporaryFile, contents)

  console.log('Uploading to bucket:', getR2Bucket())

  await uploadR2File({
    key,
    filePath: temporaryFile,
    contentType: 'text/plain',
    size: contents.length,
  })

  const result = await getR2().send(
    new HeadObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }),
  )

  console.log('R2 TEST PASSED')
  console.log('Object key:', key)
  console.log('Stored bytes:', result.ContentLength)
} catch (error) {
  console.error('R2 TEST FAILED')
  console.error('Error:', error.name)
  console.error('Message:', error.message)
  console.error('HTTP status:', error.$metadata?.httpStatusCode)
  process.exitCode = 1
} finally {
  await unlink(temporaryFile).catch(() => {})
}