// 1
const { Server } = require("socket.io"); // import { Server } from 'socket.io';

// 2
const io = new Server("5000", {
  cors: {
    // CORS 설정: 소켓 서버에 허락된 브라우저만 접근하도록 설정
    origin: "http://localhost:3000",
  },
});

// 3 : 클라이언트 연결 이벤트 처리
io.sockets.on("connection", (socket) => {
  // 4 : 클라이언트로부터 메세지 받기 (message : data, id)
  socket.on("message", (data) => {
    // 5 : 클라이언트로 메세지 다시 보내기 (나를 제외한 모든 유저)
    socket.broadcast.emit("sMessage", data);
  });
  socket.on("login", (data) => {
    socket.broadcast.emit("sLogin", data); // 클라이언트로 아이디 보내기
  });
  // 6 : 연결이 끊어짐
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
