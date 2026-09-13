import { Button } from '@/components/ui/button'

export function RolePermissionEditor({ catalog = [], presets = [], selected = [], onChange }) {
  const selectedSet = new Set(selected)
  const allKeys = catalog.flatMap((group) => group.permissions.map((item) => item.key))
  const groups = presets.length
    ? presets.map((preset) => ({
        module: preset.slug,
        label: preset.label,
        description: preset.description,
        permissions: preset.permissions,
      }))
    : catalog

  const setKeys = (next) => onChange([...new Set(next)])

  const toggle = (key) => {
    if (selectedSet.has(key)) setKeys(selected.filter((item) => item !== key))
    else setKeys([...selected, key])
  }

  const setGroup = (group, enabled) => {
    const keys = group.permissions.map((item) => item.key)
    if (enabled) setKeys([...selected, ...keys])
    else setKeys(selected.filter((key) => !keys.includes(key)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setKeys(allKeys)}>
          Select all permissions
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setKeys([])}>
          Clear all permissions
        </Button>
        <span className="text-xs text-muted-foreground self-center">
          {selected.length} of {allKeys.length} selected
        </span>
      </div>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {groups.map((group) => {
          const keys = group.permissions.map((item) => item.key)
          const checkedCount = keys.filter((key) => selectedSet.has(key)).length
          return (
            <section key={group.module} className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h3 className="font-semibold">{group.label} permissions</h3>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{checkedCount}/{keys.length}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setGroup(group, true)}>
                    Select all
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setGroup(group, false)}>
                    Clear
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {group.permissions.map((item) => (
                  <label key={`${group.module}-${item.key}`} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={selectedSet.has(item.key)}
                      onChange={() => toggle(item.key)}
                    />
                    <span>
                      <span className="font-medium">{item.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{item.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
