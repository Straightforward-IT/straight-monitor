import { describe, expect, it, vi } from 'vitest'
import { createMinimizeDockManager } from '../src'

describe('createMinimizeDockManager', () => {
  it('registers, minimizes, restores, and removes a headless region', () => {
    const manager = createMinimizeDockManager()
    const onRemove = vi.fn()

    manager.register({ id: 'document-42', title: 'Document 42', onRemove })
    expect(manager.items.value).toHaveLength(1)
    expect(manager.minimize('document-42')).toBe(true)
    expect(manager.minimizedItems.value).toHaveLength(1)
    expect(manager.restore('document-42')).toBe(true)
    expect(manager.minimizedItems.value).toHaveLength(0)
    expect(manager.remove('document-42')).toBe(true)
    expect(onRemove).toHaveBeenCalledWith('document-42')
  })

  it('keeps a minimized item after its owner releases and requests its route on restore', () => {
    const manager = createMinimizeDockManager()
    const onRestoreRequest = vi.fn()

    manager.register({
      id: 'route-document',
      title: 'Route document',
      onRestoreRequest,
    })
    manager.minimize('route-document')
    expect(manager.release('route-document')).toBe(true)
    expect(manager.get('route-document')?.attached).toBe(false)
    expect(manager.minimizedItems.value).toHaveLength(1)

    manager.restore('route-document')
    expect(onRestoreRequest).toHaveBeenCalledOnce()
    expect(manager.get('route-document')?.status).toBe('open')
  })

  it('silently unregisters an open owner and refreshes duplicate registration metadata', () => {
    const manager = createMinimizeDockManager()
    const first = manager.register({ id: 'same', title: 'First title' })
    const second = manager.register({ id: 'same', title: 'Updated title' })

    expect(second).toBe(first)
    expect(second.title).toBe('Updated title')
    expect(manager.release('same')).toBe(true)
    expect(manager.get('same')).toBeUndefined()
  })
})
