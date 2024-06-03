const { Server } = require("socket.io"); // import { Server } from 'socket.io';

const io = new Server("5000", {
  cors: {
    // CORS 설정: 소켓 서버에 허락된 브라우저만 접근하도록 설정
    origin: "http://localhost:3000",
  },
});

// 접속한 사용자 아이디를 저장하기 위한 Map 객체 (임시 사용자 데이터베이스)
const clients = new Map();

// 클라이언트 연결 이벤트 처리
io.sockets.on("connection", (socket) => {
  console.log("user connected");

  // 클라이언트로부터 메세지 받기 (message : data, id)
  socket.on("message", (res) => {
    const { target } = res; // 1:1 채팅 상대방 아이디

    const toUser = clients.get(target); // 아이디로 접속 유저 검색
    target
      ? io.sockets.to(toUser).emit("sMessage", res) // 존재하면 to()로 private 메세지 전송
      : socket.broadcast.emit("sMessage", res); // 존재하지 않으면 일반 broadcast로 메세지 전송

    // 클라이언트로 메세지 다시 보내기 (나를 제외한 모든 유저)
    // socket.broadcast.emit("sMessage", data);
  });

  socket.on("login", (data) => {
    console.log("server gets a userName: ", data);
    clients.set(data, socket.id); // "나의 아이디", "소켓 고유의 아이디" pair을 Map에 insert
    io.sockets.emit("sLogin", data); // 클라이언트로 아이디 보내기
  });
  // 연결이 끊어짐
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
