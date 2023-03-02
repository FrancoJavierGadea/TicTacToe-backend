const path = require('path');
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { generateGameCode } = require('./utils/generateGameCode');

const port = process.env.PORT || 3000;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'https://francojaviergadea.github.io',
        //origin: '*',
        methods: ['GET', 'POST']
    }
});


httpServer.listen(port, () => {

    console.log(`Server is up on http://localhost:${port}`);
});




io.on("connection", (socket) => {

    console.log('User connect');

    socket.on('create-game', (data, done) => {

        let room = generateGameCode(5);

        socket.join(room);
        socket.data.room = room;
        socket.data.player = 'player 1';
        socket.data.name = data.name;

        done({ok: true, data: {room}});
    });


    socket.on('join-game', ({room, turn, name}, done) => {

        //Get the Room
        const ROOM = io.sockets.adapter.rooms.get(room);

        if(!ROOM) return done({ok: false, message: 'La sala no existe...'});

        if(ROOM.size >= 2) return done({ok: false, message: 'La sala esta llena...'});

        //Join the Room
        socket.join(room);
        socket.data.room = room;
        socket.data.player = 'player 2';
        socket.data.name = name;

        socket.to(room).emit('joined-game', {ok: true, message: 'Conectado a la sala', data: {turn}});

        socket.to(room).emit('receive-message', {ok: true, message: 'Mensaje Recivido', data: {message: `${name} conectado...`, player: 'player 2', type: 'notification'}});

        return done({ok: true, message: 'Conectado a la sala'});
    });


    socket.on('start-game', (data, done) => {
        
        const {turn, firstGame = false} = data;

        const room = socket.data.room;

        //check if the socket is in the room
        if( !socket.rooms.has(room) ) return done({ok: false, message: 'No estas en esta sala'});

        //check if at least 2 players are in the room
        if(io.sockets.adapter.rooms.get(room).size < 2) return done({ok: false, message: 'Faltan jugadores'});


        io.to(room).emit('starting-game', {ok: true, message: 'comenzando juego', data: {turn, firstGame}});

        return done({ok: true, message: 'comenzando juego'});
    });

    socket.on('send-game-move', (data, done) => {

        const {board} = data;

        const {room, player} = socket.data;

        //check if the socket is in the room
        if( !socket.rooms.has(room) ) return done({ok: false, message: 'No estas en esta sala'});


        socket.to(room).emit('receive-game-move', {ok: true, message: 'Movimiento Recivido', data: {board, player}});

        done({ok: true, message: 'Movimiento Enviado'});
    });


    socket.on('send-message', ({message, name, player}, done) => {

        const {room} = socket.data;

        //check if the socket is in the room
        if( !socket.rooms.has(room) ) return done({ok: false, message: 'No estas en esta sala'});


        io.to(room).emit('receive-message', {ok: true, message: 'Mensaje Recivido', data: {message, name, player}});

        done({ok: true, message: 'Mensaje Enviado'});
    });

    socket.on('update-player', (data, done) => {

        const {player} = data;

        if(!player || !['player 1', 'player 2'].includes(player)) return done({ok: false, message: "valor invalido"});

        socket.data.player = player;

        return done({ok: true, message: 'player actualizado'});
    });

    socket.on('leave-game', (data, done) => {

        const {room, player, name} = socket.data;

        socket.leave(room);
        
        if(room){
            
            io.to(room).emit('disconnect-player', {ok: true, message: 'Jugador desconectado', data: {player}});
            
            io.to(room).emit('receive-message', {ok: true, message: 'Mensaje Recivido', data: {message: `${name} desconectado...`, player, type: 'notification'}});
        }

        socket.data.room = undefined;
        socket.data.player = undefined;
        
        done({ok: true, message: "Has abandonado la sala"});
    });

    socket.on("disconnect", (reason) => {

        const {room, player, name} = socket.data;

        if(room){

            io.to(room).emit('disconnect-player', {ok: true, message: 'Jugador desconectado', data: {player}});

            io.to(room).emit('receive-message', {ok: true, message: 'Mensaje Recivido', data: {message: `${name} desconectado...`, player, type: 'notification'}});
        }   
    });
});