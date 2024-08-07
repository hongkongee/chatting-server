const express = require('express');
const https = require('https');
const { Server } = require('socket.io'); // import { Server } from 'socket.io';
const mysql = require('mysql2');
const fs = require('fs');

const app = express();
const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem'),
});
const io = new Server(server, {
  cors: {
    // CORS 설정: 소켓 서버에 허락된 브라우저만 접근하도록 설정
    origin: '*',
  },
});

const db = mysql.createConnection({
  host: 'spring-database.c7ms48g6s76s.ap-northeast-2.rds.amazonaws.com',
  user: 'chat1', // MySQL 사용자 이름
  password: '123456', // MySQL 비밀번호
  database: 'issue', // 사용할 데이터베이스 이름
});

db.connect((err) => {
  if (err) {
    console.error('MySQL 연결 오류:', err);
    return;
  }
  console.log('MySQL에 연결되었습니다.');
});

// const roomClients = new Map(); -> map 타입
// let roomClients = []; -> array 타입
const connectedUsers = {}; // -> object 타입
/* 
{
  EdA9QlRDxkRrPcSbAABe: { userId: 'ㅇㅀ', roomNumber: '1' },
  'MqZZll_-m-iDVJZ1AACo': { userId: 'ㄹㄹㄹ', roomNumber: '1' }
}
*/

// connectedUsers에서 유저의 닉네임으로 socket id를 찾는 함수 (users: connectedUsers)
function findSocketIdByUserId(users, targetUserId) {
  for (const [socketId, userInfo] of Object.entries(users)) {
    if (userInfo.userId === targetUserId) {
      return socketId;
    }
  }
  return null; // 해당 userId를 가진 사용자가 없으면 null 반환
}

// const chatNamespace = io.of('/room');
io.sockets.on('connection', (socket) => {
  console.log('a user connected to the chat namespace');

  // 메세지 처리 (res : data, id, target)
  socket.on('message', (res) => {
    const { data, id, target } = res;

    /*
    // 욕설을 필터링 하기
    const filteredData = dirtyWord.reduce((acc, substring) => {
      const regex = new RegExp(`(${substring})`, 'g'); // 각 substring 찾기
      return acc.replace(regex, (match) => {
        return match[0] + '*'.repeat(match.length - 1); // 첫글자를 제외하고 '*'로 가리기
      });
    }, data); 
    console.log('dirty word into ', filteredData);*/
    const newRes = { data, id, target };

    const query =
      'INSERT INTO tbl_local_chat (room_no, nickname, text, write_date) VALUES (?, ?, ?, ?)';

    // 한국 현재 시간 구하기 (2024-07-07-T17:48:52.772T 형태)
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const koreaTimeDiff = 9 * 60 * 60 * 1000;
    const korNow = new Date(utc + koreaTimeDiff + koreaTimeDiff); // 왜 두 번 더해야 하지?

    // 시간을 DB의 datetime(6) 타입에 맞게 바꾸기
    const currentTime = korNow.toISOString().slice(0, 23).replace('T', ' ');
    console.log('currentTime:', currentTime);

    console.log('res: ', res);
    console.log('message from chat namespace:', newRes);
    // 내가 속한 방(들) 가져오기
    const myRooms = Array.from(socket.rooms);

    if (target !== '') {
      // 귓속말 기능이면 (db에 저장하지 말자)
      // const toUser = roomClients.get(target); // 아이디로 접속 유저 검색
      const toUser = findSocketIdByUserId(connectedUsers, target); // 아이디로 접속 유저 검색
      console.log('귓속말 상대:', toUser);
      io.sockets.to(toUser).emit('sMessage', newRes); // 귓속말
      return;
    } else {
      console.log('같은 방에 전송!', myRooms);
      if (myRooms.length > 1) {
        console.log('같은 방에 전송! 방번호:', myRooms[1]);
        socket.broadcast.in(myRooms[1]).emit('sMessage', newRes);

        // db에 저장하기
        db.query(query, [myRooms[1], id, data, currentTime], (err) => {
          if (err) {
            console.error('메시지 저장 오류:', err);
            return;
          }
          console.log('메세지가 정상적으로 저장되었음');
        });
        return;
      }
      socket.broadcast.emit('sMessage', newRes); // 모든 클라이언트에게 메시지 전송

      /* 
        myRooms: myRooms[0] 은 유저의 socket.id, myRooms[1]은 유저가 속한 첫번째 방 번호를 의미
        그러므로 myRooms.length <= 1의 의미는 유저가 특정 방에 속해 있지 않음을 의미한다. -> 오픈채팅
        */
    }
  });

  // 로그인 처리 (채팅방 입장)
  socket.on('login', (data) => {
    console.log('server gets a userName: ', data);
    const { userId, roomNumber } = data;
    socket.join(roomNumber); // 접속한 사용자를 특정한 방에 배정

    // 채팅방 입장하면 이전 채팅 기록 조회
    db.query(
      'SELECT * FROM tbl_local_chat WHERE room_no = ?',
      [roomNumber],
      (err, results) => {
        if (err) {
          console.error('쿼리 실행 오류:', err);
          return;
        }
        console.log('쿼리 결과:', results);

        // 클라이언트(본인에게만)에 채팅 히스토리 전송
        socket.emit('chatHistory', results);

        connectedUsers[socket.id] = { userId, roomNumber };
        const usersInRoom = Object.values(connectedUsers) // 클라이언트에 보낼 접속 유저 목록
          .filter((user) => user.roomNumber === roomNumber)
          .map((user) => user.userId);
        // console.log("data's userId : ", userId);

        console.log('after inserting: ', connectedUsers);
        io.to(roomNumber).emit('sLogin', userId);
        // socket.broadcast.emit('sLogin', userId); // 클라이언트로 아이디 보내기 (입장 메세지)
        io.to(roomNumber).emit('currentUsers', usersInRoom); // 클라이언트로 유저 목록 보내기 (프로필)
      }
    );
  });

  // 연결 해제 처리 (퇴장 메세지)
  socket.on('disconnect', () => {
    console.log('socket.id:', socket.id);

    const myUserInfo = connectedUsers[socket.id];
    if (myUserInfo) {
      const myUserId = myUserInfo['userId'];
      socket.broadcast.emit('sExit', myUserId); // 클라이언트로 아이디 보내기 (입장 메세지)
    }

    console.log('user disconnected from chat namespace');
    // 연결 해제 시 roomClients에서 자신의 아이디 제거
    // roomClients = roomClients.filter((client) => client.socketId !== socket.id);
    delete connectedUsers[socket.id];
    console.log('after removing: ', connectedUsers);
  });
});

/* 
{
  EdA9QlRDxkRrPcSbAABe: { userId: 'ㅇㅀ', roomNumber: '1' },
  'MqZZll_-m-iDVJZ1AACo': { userId: 'ㄹㄹㄹ', roomNumber: '1' }
}
*/

const port = 5000;
server.listen(port, () => {
  console.log(
    `Socket.IO server is running on https://issuetrend.online:${port}`
  );
});
