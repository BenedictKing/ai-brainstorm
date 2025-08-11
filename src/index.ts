import AIBrainstormServer from './server';
import { config } from './config';

const server = new AIBrainstormServer();
server.start(config.port);