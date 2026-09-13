import { useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Search, Shield, UserCog, UserPlus } from 'lucide-react'
import { PageHeader, DataTable, StatusBadge, EmptyState } from '@/components/shared/CommonComponents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, USE_API } from '@/api/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { RolePermissionEditor } from '@/components/admin/RolePermissionEditor'

const emptyUser = { name: '', username: '', password: '', roleId: '', status: 'active' }
const emptyRole = { name: '', accessRole: 'Reception', description: '', active: true, permissions: [] }

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

export default function UsersPage() {
  const { toast } = useToast()
  const { user: currentUser, hasPermission } = useAuth()
  const canCreateUser = hasPermission('users.create')
  const canEditUser = hasPermission('users.edit')
  const canDisableUser = hasPermission('users.disable') || canEditUser
  const canEditRoles = hasPermission('users.edit')
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [catalog, setCatalog] = useState([])
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [userOpen, setUserOpen] = useState(false)
  const [userMode, setUserMode] = useState('create')
  const [userForm, setUserForm] = useState(emptyUser)
  const [userErrors, setUserErrors] = useState({})
  const [savingUser, setSavingUser] = useState(false)
  const [viewUser, setViewUser] = useState(null)

  const [roleOpen, setRoleOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState(emptyRole)
  const [savingRole, setSavingRole] = useState(false)

  const load = async () => {
    if (!USE_API) {
      setLoading(false)
      return
    }
    const [userRows, roleRows, catalogData] = await Promise.all([
      api.getUsers(),
      api.getRoles(),
      api.getPermissionCatalog(),
    ])
    setUsers(userRows)
    setRoles(roleRows)
    setCatalog(catalogData.modules || [])
    setPresets(catalogData.presets || [])
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => toast({ title: 'Failed to load user management', description: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  const activeRoles = roles.filter((role) => role.active)
  const accessRoles = ['Reception', 'Nurse', 'Admin', 'Manager']
  const presetKeys = (slug) => (presets.find((item) => item.slug === slug)?.permissions || []).map((item) => item.key)
  const predefinedRoles = roles.filter((role) => role.predefined || ['admin', 'reception', 'nurse', 'manager'].includes(role.slug))
    .sort((a, b) => accessRoles.indexOf(a.accessRole) - accessRoles.indexOf(b.accessRole) || a.name.localeCompare(b.name))
  const customRoles = roles.filter((role) => !predefinedRoles.some((item) => item.id === role.id))

  const filteredUsers = users.filter((row) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || `${row.name} ${row.username} ${row.role}`.toLowerCase().includes(q)
    const matchesRole = roleFilter === 'all' || row.roleId === roleFilter || row.role === roleFilter
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter
    return matchesQuery && matchesRole && matchesStatus
  })

  const openCreateUser = () => {
    setUserMode('create')
    setUserForm({ ...emptyUser, roleId: activeRoles[0]?.id || '' })
    setUserErrors({})
    setUserOpen(true)
  }

  const openEditUser = (row) => {
    setUserMode('edit')
    setUserForm({
      id: row.id,
      name: row.name,
      username: row.username,
      password: '',
      roleId: row.roleId || '',
      status: row.status,
    })
    setUserErrors({})
    setUserOpen(true)
  }

  const validateUser = () => {
    const errors = {}
    if (!userForm.name.trim()) errors.name = 'Full name is required.'
    if (!userForm.username.trim()) errors.username = 'Username is required.'
    if (userMode === 'create' && !userForm.password) errors.password = 'Password is required.'
    if (userForm.password && userForm.password.length < 6) errors.password = 'Password must be at least 6 characters.'
    if (!userForm.roleId) errors.roleId = 'Role is required.'
    setUserErrors(errors)
    return !Object.keys(errors).length
  }

  const saveUser = async () => {
    if (!validateUser()) return
    setSavingUser(true)
    try {
      const body = {
        name: userForm.name.trim(),
        username: userForm.username.trim(),
        roleId: userForm.roleId,
        status: userForm.status,
      }
      if (userForm.password) body.password = userForm.password
      if (userMode === 'create') await api.createUser({ ...body, password: userForm.password })
      else await api.updateUser(userForm.id, body)
      await load()
      setUserOpen(false)
      toast({ title: userMode === 'create' ? 'User created' : 'User updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not save user', description: err.message, variant: 'destructive' })
    } finally {
      setSavingUser(false)
    }
  }

  const toggleUserStatus = async (row) => {
    const next = row.status === 'active' ? 'inactive' : 'active'
    try {
      await api.updateUser(row.id, { status: next })
      await load()
      toast({ title: next === 'active' ? 'User enabled' : 'User disabled', variant: 'success' })
    } catch (err) {
      toast({ title: 'Status change failed', description: err.message, variant: 'destructive' })
    }
  }

  const openRoleEditor = async (row = null) => {
    if (row) {
      const latest = await api.getRole(row.id).catch(() => row)
      setEditingRole(latest)
      setRoleForm({
        name: latest.name,
        accessRole: latest.accessRole,
        description: latest.description,
        active: latest.active,
        permissions: latest.permissions || [],
      })
    } else {
      setEditingRole(null)
      setRoleForm({ ...emptyRole, permissions: presetKeys('reception') })
    }
    setRoleOpen(true)
  }

  const saveRole = async () => {
    if (!roleForm.name.trim()) {
      toast({ title: 'Role name is required.', variant: 'destructive' })
      return
    }
    setSavingRole(true)
    try {
      const body = {
        name: roleForm.name.trim(),
        accessRole: roleForm.accessRole,
        description: roleForm.description,
        active: roleForm.active,
        permissions: roleForm.permissions || [],
      }
      if (editingRole) await api.updateRole(editingRole.id, body)
      else await api.createRole(body)
      await load()
      setRoleOpen(false)
      toast({ title: editingRole ? 'Role updated' : 'Role created', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not save role', description: err.message, variant: 'destructive' })
    } finally {
      setSavingRole(false)
    }
  }

  const toggleRole = async (row) => {
    try {
      await api.updateRole(row.id, { active: !row.active })
      await load()
    } catch (err) {
      toast({ title: 'Role update failed', description: err.message, variant: 'destructive' })
    }
  }

  const userColumns = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.accessRole} application access</p>
        </div>
      ),
    },
    { key: 'username', header: 'Username', render: (row) => <span className="font-mono text-xs">{row.username}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
          {row.role}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : <span className="text-muted-foreground">Never</span>),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (row.createdAt ? formatDate(row.createdAt) : '—'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setViewUser(row)}><Eye className="h-4 w-4 mr-1" /> View</Button>
          {canEditUser && (
            <Button size="sm" variant="ghost" onClick={() => openEditUser(row)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          )}
          {canDisableUser && (
            <Button
              size="sm"
              variant="outline"
              disabled={row.id === currentUser?.id}
              onClick={() => toggleUserStatus(row)}
            >
              {row.status === 'active' ? 'Disable' : 'Enable'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const roleColumns = [
    { key: 'name', header: 'Role', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'userCount', header: 'Users', render: (row) => row.userCount },
    { key: 'permissionCount', header: 'Permissions', render: (row) => row.permissionCount ?? row.permissions?.length ?? 0 },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.active ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openRoleEditor(row)}>
            <Pencil className="h-4 w-4 mr-1" /> {canEditRoles ? 'Permissions' : 'View'}
          </Button>
          {canEditRoles && (
            <Button size="sm" variant="outline" disabled={row.system} onClick={() => toggleRole(row)}>
              {row.active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Staff inherit every permission granted to their role. Permissions are stored on the role, not on the person."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search name, username, or role" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {canCreateUser && <Button onClick={openCreateUser}><UserPlus className="h-4 w-4 mr-2" /> Add User</Button>}
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : (
            <DataTable
              columns={userColumns}
              data={filteredUsers}
              emptyState={<EmptyState icon={UserCog} title="No users match these filters" description="Adjust search or add a staff account." />}
            />
          )}
        </TabsContent>

        <TabsContent value="roles">
          {canEditRoles && (
            <div className="flex justify-end mb-4">
              <Button onClick={() => openRoleEditor(null)}>
                <Plus className="h-4 w-4 mr-2" /> Create role
              </Button>
            </div>
          )}
          <h3 className="text-sm font-semibold mb-2">Predefined roles</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Admin, Reception, Nurse, and Manager come with their full task list already selected.
          </p>
          <DataTable
            columns={roleColumns}
            data={predefinedRoles}
            onRowClick={(row) => openRoleEditor(row)}
            emptyState={<EmptyState icon={Shield} title="Predefined roles are missing" description="Restart the server so Admin, Reception, Nurse, and Manager are created." />}
          />
          <h3 className="text-sm font-semibold mt-8 mb-2">Custom roles</h3>
          <DataTable
            columns={roleColumns}
            data={customRoles}
            onRowClick={(row) => openRoleEditor(row)}
            emptyState={<EmptyState icon={Shield} title="No custom roles" description="Create a role if you need a smaller set than the four predefined jobs." />}
          />
          <p className="text-xs text-muted-foreground mt-4">
            Click a role to review its permissions. The permission list is grouped by the four predefined jobs.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{userMode === 'create' ? 'Add user' : 'Edit user'}</DialogTitle>
            <DialogDescription>The selected role determines which part of the system this account can open.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} />
              <FieldError message={userErrors.name} />
            </div>
            <div>
              <Label>Username</Label>
              <Input value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} placeholder="e.g. mali or mali@hospital" />
              <FieldError message={userErrors.username} />
            </div>
            <div>
              <Label>{userMode === 'create' ? 'Password' : 'New password (optional)'}</Label>
              <Input type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} />
              <FieldError message={userErrors.password} />
            </div>
            <div>
              <Label>Role</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={userForm.roleId} onChange={(e) => setUserForm((p) => ({ ...p, roleId: e.target.value }))}>
                <option value="">Select a role</option>
                {roles.filter((role) => role.active || role.id === userForm.roleId).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} — {role.accessRole}
                  </option>
                ))}
              </select>
              <FieldError message={userErrors.roleId} />
            </div>
            <div>
              <Label>Account status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={userForm.status} onChange={(e) => setUserForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserOpen(false)}>Cancel</Button>
            <Button onClick={saveUser} disabled={savingUser}>{savingUser ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewUser?.name}</DialogTitle>
            <DialogDescription>Staff account details</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="grid gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Username</p><p className="font-mono">{viewUser.username}</p></div>
              <div><p className="text-xs text-muted-foreground">Role</p><p className="font-medium">{viewUser.role}</p></div>
              <div><p className="text-xs text-muted-foreground">Application access</p><p>{viewUser.accessRole}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={viewUser.status} /></div>
              <div><p className="text-xs text-muted-foreground">Last login</p><p>{viewUser.lastLoginAt ? formatDateTime(viewUser.lastLoginAt) : 'Never'}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p>{viewUser.createdAt ? formatDateTime(viewUser.createdAt) : '—'}</p></div>
              <div>
                <p className="text-xs text-muted-foreground">Inherited permissions</p>
                <p className="font-medium">{(viewUser.permissions || []).length} from role {viewUser.role}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Permissions — ${editingRole.name}` : 'Create role'}</DialogTitle>
            <DialogDescription>
              Choose what this role may do. Every user with this role inherits the same permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Role name</Label>
                <Input value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} disabled={editingRole?.system} />
              </div>
              <div>
                <Label>Application access</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={roleForm.accessRole}
                  disabled={editingRole?.system}
                  onChange={(e) => {
                    const accessRole = e.target.value
                    const slug = accessRole.toLowerCase()
                    setRoleForm((p) => ({
                      ...p,
                      accessRole,
                      permissions: editingRole ? p.permissions : presetKeys(slug),
                    }))
                  }}
                >
                  {(accessRoles.length ? accessRoles : ['Reception', 'Nurse', 'Admin', 'Manager']).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={roleForm.active} disabled={editingRole?.system} onChange={(e) => setRoleForm((p) => ({ ...p, active: e.target.checked }))} />
              Active
            </label>
            <RolePermissionEditor
              catalog={catalog}
              presets={presets}
              selected={roleForm.permissions || []}
              onChange={(permissions) => setRoleForm((p) => ({ ...p, permissions }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>Cancel</Button>
            {canEditRoles && (
              <Button onClick={saveRole} disabled={savingRole}>{savingRole ? 'Saving…' : 'Save permissions'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
