/** @format */

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const http = require("http");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const cors = require("cors");

app.use(bodyParser.json());
app.use(cors());
// U4TpJDhyyFUGlGXI
const UserModel = require("./modal/Usermodal");
mongoose
  .connect(
    "mongodb+srv://jeyaprakashp431:U4TpJDhyyFUGlGXI@chat-app.onsf7hy.mongodb.net/?retryWrites=true&w=majority&appName=chat-app"
  )
  .then(() => console.log("sucessfull"))
  .catch((err) => console.log(err.response));
// // save the user data to database

app.post("/user", async (req, res) => {
  const user = new UserModel({
    UserName: req.body.userName,
    Password: req.body.Password,
    firstname: req.body.firstname,
    SocketId: req.body.socketId,
  });
  await user.save();
  res.send(user);
});
// get current user
app.post("/currentuser", async (req, res) => {
  try {
    const { UserId } = req.body;
    const user = await UserModel.findById(UserId);
    if (user) {
      res.send(user);
      // console.log(user);
    }
  } catch (err) {
    console.log(err);
  }
});
// get the user name from database for validating
app.post("/login", async (req, res) => {
  try {
    const { UserName, Password } = req.body;
    const user = await UserModel.findOne({ UserName, Password });
    if (user) {
      const token = jwt.sign({ userId: user._id }, "%$46463#^475$%462&^8", {
        expiresIn: "1h",
      });
      res.send({ user, token });
      // console.log(user);
    }
  } catch (err) {
    res.send("fail");
  }
});
// get all users for search filtering
app.post("/getuser", async (req, res) => {
  try {
    const users = await UserModel.find();
    res.send(users);
  } catch (err) {
    console.log(err);
  }
});
// add the friends list
app.post("/addfriends", async (req, res) => {
  const { userid, frienduser } = req.body;
  try {
    const friendusers = await UserModel.findById(frienduser);
    const user = await UserModel.findById(userid);
    if (user) {
      user.friendsList.push(friendusers);
      await user.save();
      res.send(user);
    }
  } catch (err) {
    console.log(err);
  }
});
// remove friendlists
app.post("/removefriend", async (req, res) => {
  const { FriendId, userId } = req.body;
  try {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $pull: { friendsList: FriendId },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404);
    }
    return res.json(user);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500);
  }
});

// update chatuser
app.post("/updatechatuser", async (req, res) => {
  const { userId } = req.body;
  const chatuser = await UserModel.findById(userId);
  res.send(chatuser);
});
// get and put socket status
app.post("/socketStatus", async (req, res) => {
  const { UserId, status } = req.body;
  await UserModel.updateOne({ _id: UserId }, { status: status });
  // console.log("socket update");
  PendingMessage(UserId);
});
// set chatroom
app.post("/ChatRoom", async (req, res) => {
  const { chatId, chatRoomId } = req.body;
  const user = await UserModel.findById(chatId);
  if (user) {
    user.ChatRoom = chatRoomId;
    await user.save();
  }
});
// //
const server = http.createServer(app);
const Socket = require("socket.io");
const { log } = require("console");

const io = Socket(server, {
  cors: {
    origin: "*",
    method: ["GET,POST"],
  },
});
// io oprations
io.on("connection", (socket) => {
  // console.log("socket on");
  // Update socket id
  socket.on("update-socketId", async (id) => {
    await UserModel.updateOne({ _id: id }, { SocketId: socket.id });
  });
  socket.on("hi", (data) => console.log(data));
  socket.on("sendMsg", async (data) => {
    console.log("socket");
    const {
      sendMessage,
      SenderId,
      ReceiverId,
      SendMsgTime,
      SendMsgType,
      ReceiveMsgType,
    } = data;

    try {
      console.log(SenderId);
      const sender = await UserModel.findById(SenderId);
      const receiver = await UserModel.findById(ReceiverId);
      // Check if sender and receiver exist
      // Find or create chat between sender and receiver
      let senderChat = sender?.Chats.find(
        (chat) => chat.SenderId === SenderId && chat.ReceiverId === ReceiverId
      );
      if (!senderChat) {
        sender.Chats.push({
          SenderId: SenderId,
          ReceiverId: ReceiverId,
          Messages: [],
        });
        await sender.save();
      }
      // set the value if the receiver chat is empty
      let receiverChat;
      if (receiver.Chats.length <= 0) {
        receiver.Chats.push({
          SenderId: ReceiverId,
          ReceiverId: SenderId,
          Messages: [],
        });
        await receiver.save();
      } else {
        receiverChat = receiver.Chats.find(
          (chat) => chat.SenderId == ReceiverId && chat.ReceiverId == SenderId
        );
      }
      // Add message to sender and receiver chats
      // code for check if receiver is online or offline
      if (receiver.status == "true") {
        senderChat.Messages.push({
          message: sendMessage,
          Type: SendMsgType,
          Time: SendMsgTime,
          Status: "Delivered",
        });
        // if the user is online then save receive message
        receiverChat.Messages.push({
          message: sendMessage,
          Type: ReceiveMsgType,
          Time: SendMsgTime,
        });
        // console.log(receiver.status);
      }
      if (receiver.status == "false") {
        console.log("msg saved in pending message");
        senderChat.Messages.push({
          message: sendMessage,
          Type: SendMsgType,
          Time: SendMsgTime,
          Status: "pending",
        });
        receiver.pendingMsg.push({
          message: sendMessage,
          Sender: SenderId,
        });
      }
      // Save changes to sender and receiver
      await sender.save();
      await receiver.save();
      // send the respose to sender
      await io.to(sender.SocketId).emit("senderChat", { Chats: senderChat });
      // send the response to receiver
      await io
        .to(receiver.SocketId)
        .emit("receiveChat", { Chats: receiverChat });
    } catch (error) {
      console.error(error);
    }
  });
  // socket.on("send", (data) => console.log(data.send));
});
// io operation close
// upload the image to db

app.post("/upload", async (req, res) => {
  const { form, user } = req.body;
  const userId = await UserModel.findById(user);
  if (userId) {
    userId.ProfilePicture = form;
    // console.log(form);
    await userId.save();
    res.send(userId);
  }
});
// update user bio and username
app.post("/updateuser", async (req, res, next) => {
  try {
    const { userId, Bio, Username, Firstname } = req.body;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (Bio) {
      user.Bio = Bio;
      await user.save();
    }

    if (Firstname) {
      user.firstname = Firstname;
      await user.save();
    }

    if (Username) {
      const existingUser = await UserModel.findOne({ UserName: Username });
      if (existingUser) {
        throw new Error("Username already exists!");
      }
    }
    // const friendsList = user.friendsList;
    // if (friendsList && friendsList.length > 0) {
    //   friendsList.forEach(async (friends) => {
    //     const friendId = friends._id;
    //     console.log(friendId);
    //     const friend = await UserModel.findById(friendId);
    //     if (friend) {
    //       friend.firstname = await friend.save();
    //     }
    //   });
    // }
    res.status(200).send(user);
  } catch (error) {
    next(error);
  }
});
//save the sender and receiver messages to DB
app.post("/saveChat", async (req, res) => {
  const { SenderId, ReceiverId, userId } = req.body;
  const user = await UserModel.findById(userId);
  if (user) {
    // check if chat already exists
    const ExistsChat = user.Chats.find(
      (chat) => chat.SenderId === SenderId && chat.ReceiverId === ReceiverId
    );
    if (!ExistsChat) {
      user.Chats.push({ SenderId: SenderId, ReceiverId: ReceiverId });
      res.send(user);
    }
    await user.save();
  }
});
// get the Current chatroom all messages
app.post("/getMessages", async (req, res) => {
  const { UserId, SenderId, ReceiverId } = req.body;
  const user = await UserModel.findById(UserId);
  if (user) {
    const Chat = user.Chats.find(
      (chat) => chat.SenderId === SenderId && chat.ReceiverId === ReceiverId
    );
    if (Chat) {
      res.send(Chat.Messages);
    }
  }
});

const PendingMessage = async (userId) => {
  const user = await UserModel.findById(userId);
  if (user) {
    if (user.pendingMsg.length > 0) {
      const findChat = user.Chats.find(
        (item) => item.ReceiverId == user.pendingMsg.map((item) => item.Sender)
      );
      // console.log("find chat", FindChat);
      for (let index = 0; index < user.pendingMsg.length; index++) {
        findChat.Messages.push({
          message: user.pendingMsg[index].message,
          Type: "receive",
        });
        user.pendingMsg.shift();
        console.log("remove and saved");
      }
    }
    await user.save();
  }
};
// set the message status if user is here same chat room
const MessageTick = async (SenderId, ReceiverId) => {
  const sender = await UserModel.findById(SenderId);
  const receiver = await UserModel.findById(ReceiverId);
  if (sender.ChatRoom === ReceiverId && receiver.ChatRoom === SenderId) {
    const Chat = sender.Chats.find(
      (chat) => chat.SenderId === SenderId && chat.ReceiverId === ReceiverId
    );
    Chat.Messages.forEach((msg) => (msg.Status = "seen"));
    await sender.save();
  }
};

// port listening
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
