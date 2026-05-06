import { app } from './app'
import { env } from './config/env'

app.listen(env.PORT, () => {
  console.log(
    `Narah CMS API running on http://localhost:${env.PORT} (${env.NODE_ENV})`
  )
})
