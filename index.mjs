import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

// import constants
import CELL_STATUSES from './constants/CELL_STATUSES.mjs';
import INIT_GRID_DATA from './constants/INIT_GRID_DATA.mjs';
import INIT_LEGEND from './constants/INIT_LEGEND.mjs';
import INIT_PLAYERS_DATA from './constants/INIT_PLAYERS_DATA.mjs';

// import helpers functions
import canHover from './helpers/canHover.mjs';

const { PORT, HOST } = process.env;

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
	cors: {
		origin: '*',
		methods: 'GET',
	},
});

let rooms = {};

app.use(cors());

function clearRooms() {
	const roomsCount = Object.keys(rooms).length;
	const treshold = 1000;
	const clearRoomsCount = 500;
	if (roomsCount > treshold) {
		const roomsKeys = Object.keys(rooms);
		for (let i = 0; i < clearRoomsCount; i++) {
			delete rooms[roomsKeys[i]];
		}
	}
}

io.on('connection', (socket) => {
	// create room and initialize it
	socket.on('createGame', (data) => {
		const { userName, gameId } = data;
		// create room
		rooms[gameId] = {
			gameId,
			player1: {
				...INIT_PLAYERS_DATA.player1, // copy object
				name: userName,
			},
			player2: {
				...INIT_PLAYERS_DATA.player2, // copy object
			},
			isGameStarted: false,
		};

		// join room
		socket.join(gameId);

		// send room data to user
		socket.emit('gameCreated', { roomData: rooms[gameId] });
		clearRooms();
	});

		// join room the second player and send room data to user
		socket.on('joinGame', (data) => {
			const { userName, gameId } = data;
			socket.join(gameId);
			rooms[gameId].player2.name = userName;
			io.in(gameId).emit('gameJoined', { roomData: rooms[gameId] });
		});

		socket.on('toggleIsShipVertical', (data) => {
			const { gameId, boardId } = data;
			rooms[gameId][boardId].isShipVertical =
				!rooms[gameId][boardId].isShipVertical;
			io.in(gameId).emit('toggleIsShipVertical', {
				playersData: rooms[gameId],
			});
		});

		socket.on('toggleIsEditModeOn', (data) => {
			const { gameId, boardId } = data;
			rooms[gameId][boardId].isEditModeOn =
				!rooms[gameId][boardId].isEditModeOn;
			io.in(gameId).emit('toggleIsEditModeOn', {
				playersData: rooms[gameId],
			});
		});

		socket.on('clickOnAShipInLegend', (data) => {
			const { boardId, gameId, shipIndex } = data;

			// currLegendIndex is the index of the ship in the legend

			rooms[gameId][boardId].currLegendIndex = shipIndex;
			io.in(gameId).emit('clickOnAShipInLegend', {
				playersData: rooms[gameId],
			});
		});

		socket.on('positionRandomly', (data) => {
			const { gameId, boardId } = data;

			if (rooms[gameId][boardId].isEditModeOn) {
				const maxRow = rooms[gameId][boardId].gridData.length;
				const maxCol = rooms[gameId][boardId].gridData[0].length;

				// create a copy of empty grid
				let newGridData = INIT_GRID_DATA.map((row) => {
					return row.map((col) => col);
				});

				// create a copy of init legend
				let newLegend = INIT_LEGEND.map((ship) => ({ ...ship }));

				function getRandomInt(max) {
					return Math.floor(Math.random() * max);
				}

				function getEmptyCellCoords(gridData) {
					let row = 0;
					let col = 0;
					let isCellEmpty = false;
					// with while loop get random coords and the first one that is empty - return it.
					do {
						row = getRandomInt(maxRow);
						col = getRandomInt(maxCol);
						if (gridData[row][col] === 'EMPTY') {
							isCellEmpty = true;
						}
					} while (!isCellEmpty);

					return [row, col];
				}

				function canPositionShip(gridData, coords, isVertical, shipSize) {
					const [row, col] = coords;

					if (isVertical) {
						// test borders
						if (row + shipSize > maxRow) return false;
						for (let i = 0; i < shipSize; i++) {
							if (gridData[row + i][col] !== 'EMPTY') {
								return false;
							}
						}
					} else {
						// test borders
						if (col + shipSize > maxCol) return false;
						for (let i = 0; i < shipSize; i++) {
							if (gridData[row][col + i] !== 'EMPTY') {
								return false;
							}
						}
					}

					return true;
				}

				function getCorrdsForShip(gridData, isVertical, shipSize) {
					let canPositionShipBool;
					let coords;

					do {
						coords = getEmptyCellCoords(gridData); // return in the format of [row, col]
						canPositionShipBool = canPositionShip(
							gridData,
							coords,
							isVertical,
							shipSize
						);
					} while (!canPositionShipBool);
					return coords;
				}

				function positionShip(
					gridData,
					coords,
					isVertical,
					shipSize,
					shipIndex
				) {
					const [row, col] = coords;

					if (isVertical) {
						for (let i = 0; i < shipSize; i++) {
							gridData[row + i][col] = Number(shipIndex) + 1;
						}
					} else {
						for (let i = 0; i < shipSize; i++) {
							gridData[row][col + i] = Number(shipIndex) + 1;
						}
					}
				}

				for (let i = 0; i < newLegend.length; i++) {
					const shipIndex = i;
					const shipSize = newLegend[i].size;
					const isVertical = Math.random() < 0.5;
					const coords = getCorrdsForShip(newGridData, isVertical, shipSize);
					positionShip(newGridData, coords, isVertical, shipSize, shipIndex);
					newLegend[i].isPlaced = true;
				}

				rooms[gameId][boardId].gridData = newGridData;
				rooms[gameId][boardId].legend = newLegend;

				io.in(gameId).emit('positionRandomly', {
					playersData: rooms[gameId],
				});
			}
		});

		socket.on('mouseEnterCell', (data) => {
			// raw data properties
			const { cellCoords, gameId, boardId } = data;

			// get coordinates of the cell in nice format
			const [row, col] = cellCoords;

			// get current player data
			const currPlayerData = rooms[gameId][boardId];

			// get all player properties
			const {
				gridData,
				isShipVertical,
				isEditModeOn,
				legend,
				currLegendIndex,
			} = currPlayerData;

			// get current ship size
			const currShipSize = legend[currLegendIndex].size;

			// get boolean flag if the current ship is placed
			const { isPlaced } = legend[currLegendIndex];

			// create a copy of the gridData
			const newGridData = gridData.map((row) => [...row]);

			if (
				canHover(isShipVertical, currShipSize, newGridData, cellCoords) &&
				!isPlaced &&
				isEditModeOn
			) {
				if (isShipVertical) {
					for (let count = 0; count < currShipSize; count++) {
						if (newGridData[row + count][col] === CELL_STATUSES.EMPTY) {
							newGridData[row + count][col] = CELL_STATUSES.HOVER;
						}
					}
				} else {
					for (let count = 0; count < currShipSize; count++) {
						if (newGridData[row][col + count] === CELL_STATUSES.EMPTY) {
							newGridData[row][col + count] = CELL_STATUSES.HOVER;
						}
					}
				}
			}

			rooms[gameId][boardId].gridData = newGridData;
			io.in(gameId).emit('mouseEnterCell', {
				playersData: rooms[gameId],
			});
		});

		socket.on('mouseLeaveCell', (data) => {
			// raw data properties
			const { cellCoords, gameId, boardId } = data;

			// get current player data
			const currPlayerData = rooms[gameId][boardId];

			// get all player properties
			const {
				gridData,
				isShipVertical,
				isEditModeOn,
				legend,
				currLegendIndex,
			} = currPlayerData;

			// create a copy of the gridData
			const newGridData = gridData.map((row) => [...row]);

			for (let row = 0; row < newGridData.length; row++) {
				for (let col = 0; col < newGridData[row].length; col++) {
					if (newGridData[row][col] === CELL_STATUSES.HOVER) {
						newGridData[row][col] = CELL_STATUSES.EMPTY;
					}
				}
			}

			rooms[gameId][boardId].gridData = newGridData;

			io.in(gameId).emit('mouseLeaveCell', {
				playersData: rooms[gameId],
			});
		});

		socket.on('clickCell', (data) => {
			const { cellCoords, gameId, boardId } = data;

			// get coordinates of the cell in nice format
			const [row, col] = cellCoords;

			// get current player data
			const currPlayerData = rooms[gameId][boardId];

			// get all player properties
			const {
				gridData,
				isShipVertical,
				isEditModeOn,
				legend,
				currLegendIndex,
			} = currPlayerData;

			// get current ship size
			const currShipSize = legend[currLegendIndex].size;

			// get boolean flag if the current ship is placed
			const { isPlaced } = legend[currLegendIndex];

			// create a copy of the gridData
			const newGridData = gridData.map((row) => [...row]);

			// create a copy of the legend
			const newLegend = legend.map((ship) => ({ ...ship }));

			// define position a ship
			if (newGridData[row][col] === CELL_STATUSES.HOVER) {
				if (isShipVertical) {
					for (let count = 0; count < currShipSize; count++) {
						newGridData[row + count][col] = currLegendIndex + 1;
					}
				} else {
					for (let count = 0; count < currShipSize; count++) {
						newGridData[row][col + count] = currLegendIndex + 1;
					}
				}
				newLegend[currLegendIndex].isPlaced = true;
			} else if (isEditModeOn && typeof newGridData[row][col] === 'number') {
				// define remove ship
				const removeShipAtIndex = newGridData[row][col] - 1;
				newLegend[removeShipAtIndex].isPlaced = false;
				for (let i = 0; i < newGridData.length; i++) {
					for (let j = 0; j < newGridData[i].length; j++) {
						if (newGridData[i][j] === removeShipAtIndex + 1) {
							newGridData[i][j] = CELL_STATUSES.EMPTY;
						}
					}
				}
			}

			rooms[gameId][boardId].gridData = newGridData;
			rooms[gameId][boardId].legend = newLegend;

			io.in(gameId).emit('clickCell', {
				playersData: rooms[gameId],
			});
		});

		socket.on('ready', (data) => {
			const { gameId, boardId, playerId } = data;
			// if player is ready
			if (rooms[gameId][playerId].isReady) {
				rooms[gameId][playerId].isReady = false;
				// turn edit mode on
				rooms[gameId][boardId].isEditModeOn = true;
			} else {
				// if player is not ready, check if legend is placed
				const { legend } = rooms[gameId][boardId];
				const isLegendPlaced = legend.every((ship) => ship.isPlaced);
				if (isLegendPlaced) {
					rooms[gameId][playerId].isReady = true;
					// turn edit mode off
					rooms[gameId][boardId].isEditModeOn = false;
				}
			}

			io.in(gameId).emit('ready', {
				...rooms[gameId],
			});
			// check if both players ready, and if so, start the game
			if (rooms[gameId].player1.isReady && rooms[gameId].player2.isReady) {
				rooms[gameId].isGameStarted = true;
				io.in(gameId).emit('startGame', {
					playersData: rooms[gameId],
				});
			}
		});

		socket.on('clickTargetCell', (data) => {
			const { cellCoords, playerId, gameId } = data;
			const [row, col] = cellCoords;
			const opponentPlayerData =
				rooms[gameId][playerId === 'player1' ? 'player2' : 'player1'];

			const currentPlayerData = rooms[gameId][playerId];

			function checkWin(opponentData) {
				for (let i = 0; i < opponentData.length; i++) {
					for (let j = 0; j < opponentData[0].length; j++) {
						//return false if fine a number
						if (
							opponentData[i][j] !== 'HIT' &&
							opponentData[i][j] !== 'EMPTY'
						) {
							return false;
						}
					}
				}
				return true;
			}

			if (opponentPlayerData.gridData[row][col] === CELL_STATUSES.EMPTY) {
				return;
			} else {
				opponentPlayerData.gridData[row][col] = CELL_STATUSES.HIT;
				currentPlayerData.opponentGridData[row][col].isHit = true;
				currentPlayerData.opponentGridData[row][col].cellStatus = 'HIT';
				if (checkWin(opponentPlayerData.gridData)) {
					// change status of players
					if (playerId === 'player1') {
						rooms[gameId].player1.isWinner = true;
						rooms[gameId].player2.isWinner = false;
					} else {
						rooms[gameId].player1.isWinner = false;
						rooms[gameId].player2.isWinner = true;
					}

					io.in(gameId).emit('endGame', {
						playersData: rooms[gameId],
					});
				}
			}

			io.in(gameId).emit('clickTargetCell', {
				playersData: rooms[gameId],
			});
		});

		socket.on('mouseEnterTargetCell', (data) => {
			const { cellCoords, playerId, gameId } = data;
			const [row, col] = cellCoords;
			const targetBoardData = rooms[gameId][playerId].opponentGridData;
			if (targetBoardData[row][col].cellStatus === CELL_STATUSES.EMPTY) {
				targetBoardData[row][col].cellStatus = CELL_STATUSES.HOVER;
			}
			socket.emit('mouseEnterTargetCell', {
				playersData: rooms[gameId],
			});
		});

		socket.on('mouseLeaveTargetCell', (data) => {
			const { cellCoords, playerId, gameId } = data;
			const [row, col] = cellCoords;
			const targetBoardData = rooms[gameId][playerId].opponentGridData;
			if (targetBoardData[row][col].cellStatus === CELL_STATUSES.HOVER) {
				targetBoardData[row][col].cellStatus = CELL_STATUSES.EMPTY;
			}
			socket.emit('mouseLeaveTargetCell', {
				playersData: rooms[gameId],
			});
		});
	
});

httpServer.listen(PORT, HOST, () => {
	console.log(`Server listening on ${HOST}:${PORT}...`);
});
