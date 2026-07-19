import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const roleKey = user.role.toLowerCase()
    const dashboardPath = `/${roleKey === 'admin' ? 'admin' : roleKey}`

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, roleKey, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleKey,
        dashboardPath,
        initials: user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password')
  if (!user) return res.status(404).json({ error: 'User not found' })
  const roleKey = user.role.toLowerCase()
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleKey,
    dashboardPath: `/${roleKey === 'admin' ? 'admin' : roleKey}`,
    initials: user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
  })
})

export default router
