import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';



// import constants
import CELL_STATUSES from './constants/CELL_STATUSES.mjs';
import INIT_GRID_DATA from './constants/INIT_GRID_DATA.mjs';
import INIT_PLAYERS_DATA from './constants/INIT_PLAYERS_DATA.mjs';

// import helpers functions
import canHover from './helpers/canHover.mjs';

const { PORT, HOST } = process.env;

const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
	cors: {
		origin: '*',
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	},
});

const rooms = {};

io.on('connection', (socket) => {
	console.log('user connected');

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
		};

		// join room
		socket.join(gameId);

		// send room data to user
		socket.emit('gameCreated', { roomData: rooms[gameId] });
	});

	// join room the second player and send room data to user
	socket.on('joinGame', (data) => {
		const { userName, gameId } = data;
		console.log('userName', userName);
		console.log('gameId', gameId);
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
		rooms[gameId][boardId].isEditModeOn = !rooms[gameId][boardId].isEditModeOn;
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

	socket.on('mouseEnterCell', (data) => {
		// raw data properties
		const { cellCoords, gameId, boardId } = data;

		// get coordinates of the cell in nice format
		const [row, col] = cellCoords;

		// get current player data
		const currPlayerData = rooms[gameId][boardId];

		// get all player properties
		const { gridData, isShipVertical, isEditModeOn, legend, currLegendIndex } =
			currPlayerData;

		// get current ship size
		const currShipSize = legend[currLegendIndex].size;

		// get boolean flag if the current ship is placed
		const { isPlaced } = legend[currLegendIndex];

		// create a copy of the gridData
		const newGridData = gridData.map((row) => [...row]);

		if (
			canHover(isShipVertical, currShipSize, newGridData, cellCoords) &&
			!isPlaced
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
		const { gridData, isShipVertical, isEditModeOn, legend, currLegendIndex } =
			currPlayerData;

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


		socket.on('resetRooms', (data) => {
			rooms = {}
		});
	/*

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

*/
});

httpServer.listen(PORT, HOST, () => {
	console.log(`Server listening on ${HOST}:${PORT}...`);
});
