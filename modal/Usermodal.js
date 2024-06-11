/** @format */

const mongoose = require("mongoose");
const Usermodal = new mongoose.Schema(
  {
    UserName: String,
    Password: String,
    firstname: String,
    SocketId: String,
    status: String,
    friendsList: [{}],
    ProfilePicture: String,
    Bio: String,
    ChatRoom: String,
    Chats: [
      {
        SenderId: String,
        ReceiverId: String,
        Messages: [],
      },
    ],
    pendingMsg: [],
  },
  { timestamps: true }
);

const User = mongoose.model("User", Usermodal);

module.exports = User;
