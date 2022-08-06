import CELL_STATUSES from '../constants/CELL_STATUSES.mjs';

function canHover(isShipVertical, currShipSize, newGridData, cellCoords) {
	const [rowIndex, colIndex] = cellCoords;

	let flag = true;
	if (isShipVertical) {
		for (let row = rowIndex; row < rowIndex + currShipSize; row++) {
			if (
				!(newGridData[row][colIndex] === CELL_STATUSES.EMPTY) ||
				rowIndex + currShipSize > newGridData.length
			) {
				flag = false;
				return flag;
			}
		}
	} else {
		for (let col = colIndex; col < colIndex + currShipSize; col++) {
			if (!(newGridData[rowIndex][col] === CELL_STATUSES.EMPTY)) {
				flag = false;
				return flag;
			}
		}
	}

	return flag;
}

export default canHover;
