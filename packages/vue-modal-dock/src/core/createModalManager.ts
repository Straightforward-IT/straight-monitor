import {
  computed,
  markRaw,
  shallowReactive,
  shallowRef,
  type Component,
} from 'vue'
import type {
  ModalDefinition,
  ModalManager,
  ModalManagerOptions,
  ModalProps,
  ModalRecord,
  ModalStatus,
} from './types'

interface MutableModalRecord<TProps extends ModalProps = ModalProps> {
  id: string
  title: string
  component: Component
  icon?: string
  props?: TProps
  persistence?: ModalDefinition<TProps>['persistence']
  onRemove?: (id: string) => void
  status: ModalStatus
  createdAt: number
  updatedAt: number
}

export class ModalDockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModalDockError'
  }
}

export class ModalLimitError extends ModalDockError {
  readonly limit: number

  constructor(limit: number) {
    super(`Cannot open another modal because the limit of ${limit} was reached.`)
    this.name = 'ModalLimitError'
    this.limit = limit
  }
}

function resolveMaxModals(value: number | undefined): number {
  if (value === undefined || value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new ModalDockError('maxModals must be a positive integer.')
  }
  return value
}

function normalizeId(id: string): string {
  const normalized = typeof id === 'string' ? id.trim() : ''
  if (!normalized) {
    throw new ModalDockError('Modal definitions require a non-empty id.')
  }
  return normalized
}

function normalizeTitle(title: string): string {
  const normalized = typeof title === 'string' ? title.trim() : ''
  if (!normalized) {
    throw new ModalDockError('Modal definitions require a non-empty title.')
  }
  return normalized
}

export function createModalManager(
  options: ModalManagerOptions = {},
): ModalManager {
  const maxModals = resolveMaxModals(options.maxModals)
  const records = shallowRef<MutableModalRecord[]>([])
  const recordsById = new Map<string, MutableModalRecord>()
  const closeHandlers = new Map<string, () => void>()

  const modals = computed<readonly ModalRecord[]>(() => records.value)
  const openModals = computed<readonly ModalRecord[]>(() =>
    records.value.filter(record => record.status === 'open'),
  )
  const minimizedModals = computed<readonly ModalRecord[]>(() =>
    records.value.filter(record => record.status === 'minimized'),
  )

  function get(id: string): ModalRecord | undefined {
    return recordsById.get(id)
  }

  function open<TProps extends ModalProps = ModalProps>(
    definition: ModalDefinition<TProps>,
  ): ModalRecord<TProps> {
    const id = normalizeId(definition?.id)
    const title = normalizeTitle(definition?.title)
    if (!definition.component) {
      throw new ModalDockError('Modal definitions require a component.')
    }

    const existing = recordsById.get(id)
    if (existing) {
      existing.title = title
      existing.icon = definition.icon
      existing.props = definition.props ? { ...definition.props } : undefined
      existing.persistence = definition.persistence
      existing.onRemove = definition.onRemove
      existing.status = 'open'
      existing.updatedAt = Date.now()
      records.value = [
        ...records.value.filter(candidate => candidate !== existing),
        existing,
      ]
      return existing as ModalRecord<TProps>
    }

    if (records.value.length >= maxModals) {
      throw new ModalLimitError(maxModals)
    }

    const now = Date.now()
    const record = shallowReactive<MutableModalRecord<TProps>>({
      id,
      title,
      component: markRaw(definition.component),
      icon: definition.icon,
      props: definition.props ? { ...definition.props } : undefined,
      persistence: definition.persistence,
      onRemove: definition.onRemove,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })

    recordsById.set(id, record as MutableModalRecord)
    records.value = [...records.value, record as MutableModalRecord]
    return record as ModalRecord<TProps>
  }

  function updateTitle(id: string, title: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false
    record.title = normalizeTitle(title)
    record.updatedAt = Date.now()
    return true
  }

  function setStatus(id: string, status: ModalStatus): boolean {
    const record = recordsById.get(id)
    if (!record) return false

    record.status = status
    record.updatedAt = Date.now()
    if (status === 'open') {
      records.value = [
        ...records.value.filter(candidate => candidate !== record),
        record,
      ]
    }
    return true
  }

  function minimize(id: string): boolean {
    return setStatus(id, 'minimized')
  }

  function restore(id: string): boolean {
    return setStatus(id, 'open')
  }

  function setCloseHandler(id: string, handler: () => void): () => void {
    closeHandlers.set(id, handler)
    return () => {
      if (closeHandlers.get(id) === handler) closeHandlers.delete(id)
    }
  }

  function requestClose(id: string): boolean {
    if (!recordsById.has(id)) return false
    const handler = closeHandlers.get(id)
    if (!handler) return remove(id)
    restore(id)
    handler()
    return !recordsById.has(id)
  }

  function remove(id: string): boolean {
    const record = recordsById.get(id)
    if (!record) return false

    recordsById.delete(id)
    closeHandlers.delete(id)
    records.value = records.value.filter(candidate => candidate !== record)
    record.onRemove?.(record.id)
    return true
  }

  function removeAll(): number {
    const removedRecords = records.value
    recordsById.clear()
    closeHandlers.clear()
    records.value = []
    for (const record of removedRecords) record.onRemove?.(record.id)
    return removedRecords.length
  }

  return {
    modals,
    openModals,
    minimizedModals,
    get,
    open,
    updateTitle,
    setCloseHandler,
    requestClose,
    minimize,
    restore,
    remove,
    removeAll,
  }
}
