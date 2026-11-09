import { describe, expect, it } from 'vitest'
import { formatDuration, recordingStateText, splitRecordings } from './recordingQueue'

describe('recordingQueue', () => {
  it('garde la plus récente', () => {
    const r = splitRecordings([{ at: 1 }, { at: 5 }, { at: 3 }])
    expect(r.latest).toEqual({ at: 5 })
    expect(r.older).toEqual([{ at: 3 }, { at: 1 }])
    expect(splitRecordings([]).latest).toBeNull()
  })
  it('formate la durée', () => {
    expect(formatDuration(45_000)).toBe('45 s')
    expect(formatDuration(83_000)).toBe('1 min 23 s')
    expect(formatDuration(120_000)).toBe('2 min 00 s')
  })
  it('texte d\'état', () => {
    expect(recordingStateText({ recording: true, waiting: false })).toMatch(/en cours/)
    expect(recordingStateText({ recording: false, waiting: true })).toMatch(/5 s/)
    expect(recordingStateText({ recording: false, waiting: false })).toBe('')
  })
})
