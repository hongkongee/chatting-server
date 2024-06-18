const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server('5000', {
  cors: {
    // CORS 설정: 소켓 서버에 허락된 브라우저만 접근하도록 설정
    origin: '*',
  },
});

// // 접속한 사용자 아이디를 저장하기 위한 Map 객체 (임시 사용자 데이터베이스)
// const clients = new Map();

// // 클라이언트 연결 이벤트 처리
// io.sockets.on('connection', (socket) => {
//   console.log('user connected');

//   // 클라이언트로부터 메세지 받기 (message : data, id, target)
//   socket.on('message', (res) => {
//     const { target } = res; // 1:1 채팅 상대방 아이디

//     const toUser = clients.get(target); // 아이디로 접속 유저 검색
//     target
//       ? io.sockets.to(toUser).emit('sMessage', res) // 존재하면 to()로 private 메세지 전송
//       : socket.broadcast.emit('sMessage', res); // 존재하지 않으면 일반 broadcast로 메세지 전송

//     // 클라이언트로 메세지 다시 보내기 (나를 제외한 모든 유저)
//     // socket.broadcast.emit("sMessage", data);
//   });

//   socket.on('login', (data) => {
//     console.log('server gets a userName: ', data);
//     clients.set(data, socket.id); // "나의 아이디", "소켓 고유의 아이디" pair을 Map에 insert
//     io.sockets.emit('sLogin', data); // 클라이언트로 아이디 보내기
//   });

//   // 연결이 끊어짐
//   socket.on('disconnect', () => {
//     console.log('user disconnected');
//     for (let [userId, socketId] of clients.entries()) {
//       if (socketId === socket.id) {
//         clients.delete(userId);
//         break;
//       }
//     }
//   });
// });

// ============================ /room 네임스페이스 ============================

// const roomClients = new Map(); -> map 타입
// let roomClients = []; -> array 타입
const connectedUsers = {}; // -> object 타입

// const chatNamespace = io.of('/room');
io.sockets.on('connection', (socket) => {
  console.log('a user connected to the chat namespace');

  // 메세지 처리 (res : data, id, target)
  socket.on('message', (res) => {
    console.log('message from chat namespace:', res);
    const { target } = res; // 1:1 채팅 상대방 아이디

    if (target) {
      // 귓속말 기능이면
      // const toUser = roomClients.get(target); // 아이디로 접속 유저 검색
      const toUser = connectedUsers[target]; // 아이디로 접속 유저 검색
      io.sockets.to(toUser).emit('sMessage', res); // 귓속말
      return;
    }

    // 내가 속한 방(들) 가져오기
    const myRooms = Array.from(socket.rooms);
    /* 
    myRooms: myRooms[0] 은 유저의 socket.id, myRooms[1]은 유저가 속한 첫번째 방 번호를 의미
    그러므로 myRooms.length <= 1의 의미는 유저가 특정 방에 속해 있지 않음을 의미한다. -> 오픈채팅
    */
    if (myRooms.length > 1) {
      socket.broadcast.in(myRooms[1]).emit('sMessage', res);
      return;
    }
    socket.broadcast.emit('sMessage', res);
  });

  // 로그인 처리
  socket.on('login', (data) => {
    console.log('server gets a userName: ', data);
    const { userId, roomNumber } = data;
    socket.join(roomNumber); // 접속한 사용자를 특정한 방에 배정

    // 현재 접속중인 유저 목록
    // roomClients.set(userId, socket.id); // "나의 아이디", "소켓 고유의 아이디" pair을 Map에 insert
    // roomClients.push({
    //   userId: userId,
    //   socketId: socket.id,
    //   roomNumber: roomNumber,
    // });

    connectedUsers[socket.id] = { userId, roomNumber };
    const usersInRoom = Object.values(connectedUsers)
      .filter((user) => user.roomNumber === roomNumber)
      .map((user) => user.userId);
    // console.log("data's userId : ", userId);

    console.log('after inserting: ', usersInRoom);
    io.emit('sLogin', userId); // 클라이언트로 아이디 보내기
    io.to(roomNumber).emit('currentUsers', usersInRoom); // 클라이언트로 유저 목록 보내기
  });

  // 연결 해제 처리
  socket.on('disconnect', () => {
    console.log('user disconnected from chat namespace');
    // 연결 해제 시 roomClients에서 자신의 아이디 제거
    // roomClients = roomClients.filter((client) => client.socketId !== socket.id);
    delete connectedUsers[socket.id];
    console.log('after removing: ', connectedUsers);
  });
});
