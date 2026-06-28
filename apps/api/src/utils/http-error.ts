export class HttpError extends Error {
  statusCode: number
  code?: string
  issues?: string[]

  constructor({
    message,
    statusCode,
    code,
    issues
  }: {
    message: string
    statusCode: number
    code?: string
    issues?: string[]
  }) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
    this.issues = issues
  }
}
