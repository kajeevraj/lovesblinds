// The window-treatment models, one factory: createModel('roller' | 'zebra' | 'curtains', env). See shade.js and curtains.js for the inputs.
import { createShade } from './shade.js';
import { createCurtains } from './curtains.js';

export const createModel = (kind, env) => (kind === 'curtains' ? createCurtains(env) : createShade(kind, env));
export { createShade, createCurtains };
