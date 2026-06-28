import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(120, 'Name is too long.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(200, 'Password is too long.')
})

export type RegisterInput = z.infer<typeof registerSchema>

export const acceptPoliciesSchema = z.object({
  policyDocumentIds: z.array(z.string().uuid()).min(1)
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional()
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200)
})

export type LoginInput = z.infer<typeof loginSchema>
export type AcceptPoliciesInput = z.infer<typeof acceptPoliciesSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
