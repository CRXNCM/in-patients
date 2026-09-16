# Dashboard visual style

Reusable **command-overview** look first shipped on the Admin Dashboard.

Implementation: `frontend/src/components/shared/DashboardChrome.jsx`  
Reference pages: `AdminDashboard.jsx`, `NurseDashboard.jsx`, `ManagerDashboard.jsx`

Do not copy class strings into Reception, Nurse, or Manager. Import the chrome helpers instead.

---

## When to use it

Use this chrome for role home pages that show live operational numbers.

Do **not** use it for dense CRUD screens (Users, Hospital Setup, billing forms). Those stay on the quieter `PageHeader` + `border bg-card shadow-sm` pattern.

---

## Building blocks

| Export | Purpose |
| --- | --- |
| `DashboardFrame` | Full-bleed page: sky glow + grid + `max-w-[1400px]` |
| `DashboardHero` | Live dot, uppercase kicker, large title, optional `generatedAt` |
| `DashboardPanel` | Glass panel (`rounded-2xl`, blur, primary edge). Set `glow` for the corner bloom |
| `SectionKicker` | `11px` uppercase tracking label |
| `MetricRing` | CSS conic ring for a 0–100 percentage |
| `LiveDot` | Small green pulse |
| `DASHBOARD_PANEL` | Class string if you need a raw `div` |
| `DASHBOARD_TILE` | Inner inset tile |
| `DASHBOARD_OUTLINE_BUTTON` | Primary outline on `Button variant="outline"` |
| `DASHBOARD_FOLD_GRID` | `lg:grid-cols-12` + `gap-5` |

---

## Minimal usage

```jsx
import { Button } from '@/components/ui/button'
import {
  DashboardFrame,
  DashboardHero,
  DashboardPanel,
  SectionKicker,
  DASHBOARD_OUTLINE_BUTTON,
  DASHBOARD_FOLD_GRID,
} from '@/components/shared/DashboardChrome'

export default function ExampleDashboard() {
  return (
    <DashboardFrame>
      <DashboardHero
        kicker="Operations"
        title="Command overview"
        description="Short purpose of this role home."
        generatedAt={data?.generatedAt}
        action={
          <Button type="button" variant="outline" size="sm" className={DASHBOARD_OUTLINE_BUTTON}>
            Sync data
          </Button>
        }
      />

      <div className={DASHBOARD_FOLD_GRID}>
        <DashboardPanel glow className="lg:col-span-7" aria-labelledby="example-heading">
          <SectionKicker>Primary</SectionKicker>
          <h2 id="example-heading" className="mt-2 text-lg font-semibold tracking-tight">
            Section title
          </h2>
          <p className="mt-6 text-5xl font-semibold tracking-tighter tabular-nums text-primary">
            {value}
          </p>
        </DashboardPanel>
      </div>
    </DashboardFrame>
  )
}
```

---

## Visual rules

Keep:

- Inter and existing primary / success / warning / destructive tokens
- Tabular numbers
- Uppercase kickers, not icon wells
- Permission-aware omission (no fake zeros)
- `DataTable` + `StatusBadge` inside a `DashboardPanel` with `padded={false}` for tables

Avoid:

- Neon purple, extra chart libraries, `StatCard` icon squares
- Fake “vs yesterday” trends
- Applying this chrome to every admin list page

---

## Tokens (Tailwind)

- Surface: `bg-card/90 shadow-sm backdrop-blur-sm dark:bg-slate-950/70`
- Edge: `border-primary/15 dark:border-white/10`
- Accent text: `text-primary`
- Hero metric: `text-5xl font-semibold tracking-tighter tabular-nums text-primary`
- Secondary metric: `text-2xl font-semibold tabular-nums`
- Caption: `text-[11px] uppercase tracking-wider text-muted-foreground`
