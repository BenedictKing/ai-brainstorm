import AIBrainstormServer from './server.js';
import { config } from './config';

const server = new AIBrainstormServer();
server.start(config.port);
