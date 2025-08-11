import AIBrainstormServer from './server.js'
import { config } from './config/index.js'

const server = new AIBrainstormServer()
server.start(config.port)
