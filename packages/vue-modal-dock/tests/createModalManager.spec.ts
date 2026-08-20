import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  createModalManager,
  ModalDockError,
  ModalLimitError,
} from '../src'

const FirstComponent = defineComponent({ name: 'FirstComponent' })
const ReplacementComponent = defineComponent({ name: 'ReplacementComponent' })

describe('createModalManager', () => {
  it('opens, minimizes, restores, and removes one modal record', () => {
    const manager = createModalManager()
    const record = manager.open({
      id: 'first',
      title: 'First modal',
      component: FirstComponent,
      props: { answer: 42 },
    })

    expect(manager.modals.value).toEqual([record])
    expect(manager.openModals.value).toEqual([record])
    expect(manager.minimizedModals.value).toHaveLength(0)

    expect(manager.minimize('first')).toBe(true)
    expect(record.status).toBe('minimized')
    expect(manager.openModals.value).toHaveLength(0)
    expect(manager.minimizedModals.value).toEqual([record])

    expect(manager.restore('first')).toBe(true)
    expect(record.status).toBe('open')
    expect(manager.get('first')).toBe(record)

    expect(manager.remove('first')).toBe(true)
    expect(manager.modals.value).toHaveLength(0)
    expect(manager.get('first')).toBeUndefined()
  })

  it('restores an existing ID, refreshes metadata, and preserves its component contract', () => {
    const manager = createModalManager()
    const original = manager.open({
      id: 'stable',
      title: 'Stable modal',
      component: FirstComponent,
    })
    manager.minimize('stable')

    const reopened = manager.open({
      id: 'stable',
      title: 'Replacement attempt',
      component: ReplacementComponent,
      props: { refreshed: true },
    })

    expect(reopened).toBe(original)
    expect(reopened.status).toBe('open')
    expect(reopened.title).toBe('Replacement attempt')
    expect(reopened.component).toBe(FirstComponent)
    expect(reopened.props).toEqual({ refreshed: true })
    expect(manager.modals.value).toHaveLength(1)
  })

  it('keeps multiple instances of the same component independent by ID', () => {
    const manager = createModalManager()

    manager.open({ id: 'document-a', title: 'Document A', component: FirstComponent })
    manager.open({ id: 'document-b', title: 'Document B', component: FirstComponent })
    manager.minimize('document-a')

    expect(manager.modals.value.map(modal => modal.id)).toEqual([
      'document-a',
      'document-b',
    ])
    expect(manager.get('document-a')?.status).toBe('minimized')
    expect(manager.get('document-b')?.status).toBe('open')
  })

  it('copies the outer props object owned by the caller', () => {
    const manager = createModalManager()
    const props = { label: 'Original' }
    const record = manager.open({
      id: 'props',
      title: 'Props modal',
      component: FirstComponent,
      props,
    })

    props.label = 'Changed elsewhere'
    expect(record.props).toEqual({ label: 'Original' })
  })

  it('enforces the configured modal limit', () => {
    const manager = createModalManager({ maxModals: 1 })
    manager.open({ id: 'first', title: 'First', component: FirstComponent })

    expect(() =>
      manager.open({ id: 'second', title: 'Second', component: FirstComponent }),
    ).toThrow(ModalLimitError)
  })

  it('rejects malformed configuration and definitions', () => {
    expect(() => createModalManager({ maxModals: 0 })).toThrow(ModalDockError)

    const manager = createModalManager()
    expect(() =>
      manager.open({ id: ' ', title: 'Broken', component: FirstComponent }),
    ).toThrow(ModalDockError)
    expect(() =>
      manager.open({ id: 'broken', title: ' ', component: FirstComponent }),
    ).toThrow(ModalDockError)
  })

  it('removes all records and reports the removed count', () => {
    const manager = createModalManager()
    const removedIds: string[] = []
    manager.open({
      id: 'one',
      title: 'One',
      component: FirstComponent,
      onRemove: id => removedIds.push(id),
    })
    manager.open({ id: 'two', title: 'Two', component: FirstComponent })

    expect(manager.removeAll()).toBe(2)
    expect(manager.modals.value).toHaveLength(0)
    expect(removedIds).toEqual(['one'])
    expect(manager.removeAll()).toBe(0)
  })

  it('notifies the consumer after a modal is removed', () => {
    const manager = createModalManager()
    const removedIds: string[] = []
    manager.open({
      id: 'document-42',
      title: 'Document',
      component: FirstComponent,
      onRemove: id => removedIds.push(id),
    })

    expect(manager.remove('document-42')).toBe(true)
    expect(removedIds).toEqual(['document-42'])
  })

  it('keeps separately created managers isolated', () => {
    const firstManager = createModalManager()
    const secondManager = createModalManager()
    firstManager.open({ id: 'only-first', title: 'Only first', component: FirstComponent })

    expect(firstManager.modals.value).toHaveLength(1)
    expect(secondManager.modals.value).toHaveLength(0)
  })
})
