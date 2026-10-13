import { PassThrough } from 'node:stream'
import { stringify } from 'csv-stringify/sync'
import ExcelJS from 'exceljs'
import { Zip, ZipDeflate } from 'fflate'
import { XLSX_FORMATS, csvCell, xlsxCell } from './cells'
import type { Dataset } from './datasets'

const enc = new TextEncoder()
const BOM = '\uFEFF' // lets Excel open UTF-8 CSV (e.g. Hindi names) correctly

/** Byte sink with back-pressure. */
export interface Sink {
  write(chunk: Uint8Array): Promise<void>
}

/** CSV text for one dataset, produced batch by batch. */
export async function* csvChunks(ds: Dataset): AsyncGenerator<string> {
  yield BOM + stringify([ds.columns.map((c) => c.header)])
  for await (const batch of ds.rows()) {
    const records = batch.map((row) => ds.columns.map((c) => csvCell(c.type, row[c.key])))
    if (records.length) yield stringify(records)
  }
}

export async function writeCsv(sink: Sink, ds: Dataset) {
  for await (const chunk of csvChunks(ds)) await sink.write(enc.encode(chunk))
}

/** One CSV file per dataset inside a streamed ZIP archive. */
export async function writeCsvZip(sink: Sink, datasets: Dataset[]) {
  const pending: Uint8Array[] = []
  let failure: unknown = null
  const zip = new Zip((err, chunk, _final) => {
    if (err) failure = err
    else pending.push(chunk)
  })
  const flush = async () => {
    if (failure) throw failure
    while (pending.length) await sink.write(pending.shift()!)
  }
  for (const ds of datasets) {
    const file = new ZipDeflate(`${ds.name}.csv`, { level: 6 })
    zip.add(file)
    for await (const chunk of csvChunks(ds)) {
      file.push(enc.encode(chunk))
      await flush()
    }
    file.push(new Uint8Array(0), true)
    await flush()
  }
  zip.end()
  await flush()
}

/** One worksheet per dataset, streamed row by row (exceljs streaming writer). */
export async function writeXlsx(sink: Sink, datasets: Dataset[]) {
  const pass = new PassThrough()
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useSharedStrings: false, useStyles: true })
  wb.creator = 'Quick Money'
  wb.created = new Date()

  // Forward bytes to the sink, pausing exceljs while the client catches up.
  let chain = Promise.resolve()
  let failure: unknown = null
  pass.on('data', (chunk: Buffer) => {
    pass.pause()
    chain = chain
      .then(() => sink.write(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)))
      .catch((e) => {
        failure = e
      })
      .finally(() => pass.resume())
  })
  const ended = new Promise<void>((resolve, reject) => {
    pass.on('end', () => resolve())
    pass.on('error', reject)
  })

  for (const ds of datasets) {
    const ws = wb.addWorksheet(ds.sheet.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = ds.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.min(Math.max(c.header.length + 2, c.type === 'text' ? 18 : 14), 40),
      style: XLSX_FORMATS[c.type] ? { numFmt: XLSX_FORMATS[c.type] } : {},
    }))
    ws.getRow(1).font = { bold: true }
    for await (const batch of ds.rows()) {
      if (failure) throw failure
      for (const row of batch) {
        ws.addRow(ds.columns.map((c) => xlsxCell(c.type, row[c.key]))).commit()
      }
      await chain
    }
    ws.commit()
  }
  await wb.commit()
  await ended
  await chain
  if (failure) throw failure
}
