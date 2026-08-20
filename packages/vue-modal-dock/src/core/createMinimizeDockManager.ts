import { computed, shallowReactive, shallowRef } from 'vue'
import { ModalDockError } from './createModalManager'
import type {
  MinimizableDefinition,
  MinimizableRecord,
  MinimizeDockManager,
  ModalStatus,
} from './types'

interface MutableMinimizableRecord {
  id: string
  title: string
  status: ModalStatus
  attached: boolean
  createdAt: number
  updatedAt: number
  onRestoreRequest?: () => void
  onRemove?: (id: string) => void
}

function normalize(value: string, field: 'id' | 'title'): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    throw new ModalDockError(`Minimizable regions require a non-empty ${field}.`)
  }
  return normalized
}

export function createMinimizeDockManager(): MinimizeDockManager {
  const records = shallowRef<MutableMinimizableRecord[]>([])
  const recordsById = new Map<string, MutableMinimizableRecord>()

  const items = computed<readonly MinimizableRecord[]>(() => records.value)
  const minimizedItems = computed<readonly MinimizableRecord[]>(() =>
    records.value.filter(record => record.status === 'minimized'),
  )

  function get(id: string): MinimizableRecord | undefined {
    return recordsById.get(id)
  }

  function register(definition: MinimizableDefinition): MinimizableRecord {
    const id = normalize(definition?.id, 'id')
    const title = normalize(definition?.title, 'title')
    const existing = recordsById.get(id)

    if (existing) {
      existing.title = title
      existing.attached = true
      existing.onRestoreRequest = definition.onRestoreRequest
      existing.onRemove = definition.onRemove
      existing.updatedAt = Date.now()
      return existing
    }

    const now = Date.now()
    const record = shallowReactive<MutableMinimizableRecord>({
      id,
      title,
      status: 'open',
      attached: true,
      createdAt: now,
      updatedAt: now,
      onRestoreRequest: definition.onRestoreRequest,
      onRemove: definition.onRemove,
    })
    recordsById.set(id, record)
    records.value = [...records.value, record]
    return record
  }

  function release(id: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false

    if (record.status !== 'minimized') return unregister(id)
    record.attached = false
    record.onRemove = undefined
    record.updatedAt = Date.now()
    return true
  }

  function unregister(id: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false
    recordsById.delete(id)
    records.value = records.value.filter(candidate => candidate !== record)
    return true
  }

  function minimize(id: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false
    record.status = 'minimized'
    record.updatedAt = Date.now()
    return true
  }

  function restore(id: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false
    const request = record.attached ? undefined : record.onRestoreRequest
    record.status = 'open'
    record.updatedAt = Date.now()
    request?.()
    return true
  }

  function remove(id: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false
    unregister(id)
    record.onRemove?.(record.id)
    return true
  }

  function removeAll(): number {
    const removed = records.value
    recordsById.clear()
    records.value = []
    for (const record of removed) record.onRemove?.(record.id)
    return removed.length
  }

  return {
    items,
    minimizedItems,
    get,
    register,
    release,
    unregister,
    minimize,
    restore,
    remove,
    removeAll,
  }
}
