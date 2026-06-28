import type { RequestHandler } from 'express'
import { getRequiresPolicyAcceptance } from '../modules/auth/auth.service'

export const requireAcceptedPolicies: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        message: 'Authentication required'
      })
      return
    }

    const requiresPolicyAcceptance = await getRequiresPolicyAcceptance(req.user.id)

    if (requiresPolicyAcceptance) {
      res.status(403).json({
        message: 'Policy acceptance required',
        code: 'POLICY_ACCEPTANCE_REQUIRED'
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}
