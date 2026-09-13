import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { buildSearchResults } from '../services/globalSearch.js'

const router = Router()

router.get('/', authRequired, async (req, res) => {
  try {
    res.json(await buildSearchResults(req.auth, req.query.q))
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Failed to search' })
  }
})

export default router
