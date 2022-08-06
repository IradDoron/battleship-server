import INIT_GRID_DATA from './INIT_GRID_DATA.mjs';
import INIT_LEGEND from './INIT_LEGEND.mjs';

const INIT_PLAYERS_DATA = {
	player1: {
		name: '',
		gridData: INIT_GRID_DATA,
		legend: INIT_LEGEND,
		currLegendIndex: 0,
		isShipVertical: false,
		isEditModeOn: true,
	},
	player2: {
		name: '',
		gridData: INIT_GRID_DATA,
		legend: INIT_LEGEND,
		currLegendIndex: 0,
		isShipVertical: false,
		isEditModeOn: true,
	},
};

export default INIT_PLAYERS_DATA;
