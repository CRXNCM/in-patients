# MedBill Pro — Hospital In-Patient Billing & Deposit Management System

A modern, professional hospital billing dashboard demo built with React, Vite, Tailwind CSS, and shadcn/ui components.

## Features

### Four User Roles
- **Reception** — Approve nurse charges, patient billing, deposits, invoices
- **Nurse** — Record patient services (pending approval workflow)
- **Admin** — Services, medicines, departments, settings
- **Manager** — Executive dashboard, analytics, reports

### Nurse → Reception Workflow
1. Nurse records services from admin-defined categories (no pricing control)
2. Each entry enters **Pending** state
3. Reception reviews on dashboard or **Pending Approvals** page
4. **Approved** entries affect patient bill and deposit balance
5. **Rejected** entries are logged with reason in audit trail
6. Full service timeline and audit trail per patient

### Tech Stack
- React 18 (JavaScript — no TypeScript)
- Vite
- Tailwind CSS
- shadcn/ui (Radix UI primitives)
- Lucide React icons
- Recharts for analytics
- React Router v6

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and select a role to enter the dashboard.

## Build

```bash
npm run build
npm run preview
```

## Demo Notes

- All data is mock/sample data (Ethiopian Birr — ETB)
- No backend required — frontend demo only
- Dark mode toggle supported
- Responsive mobile layout
