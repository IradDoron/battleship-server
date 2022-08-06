import GRID_SIZE from './GRID_SIZE.mjs';
import CELL_STATUSES from './CELL_STATUSES.mjs';

const INIT_GRID_DATA = new Array(GRID_SIZE)
	.fill(0)
	.map(() => new Array(GRID_SIZE).fill(CELL_STATUSES.EMPTY));

export default INIT_GRID_DATA;
