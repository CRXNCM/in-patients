import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { authRequired } from '../middleware/auth.js'
import { toAuthSession } from '../utils/roles.js'

const router = Router()

async function loadRole(user) {
  if (!user?.roleId) return null
  return Role.findById(user.roleId)
}

function signToken(user) {
  const roleKey = user.role.toLowerCase()
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const login = String(email).toLowerCase().trim()
    const user = await User.findOne({ $or: [{ email: login }, { username: login }] })
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    user.lastLoginAt = new Date()
    await user.save()

    const role = await loadRole(user)
    res.json({
      token: signToken(user),
      user: toAuthSession(user, role),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', authRequired, async (req, res) => {
  const user = req.auth.user
  res.json(toAuthSession(user, req.auth.role))
})

export default router
