import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import React from "react";

const Room = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [file, setFile] = useState(null);


  useEffect(() => {
    fetch("http://localhost:3001/auth/me", {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setUserId(data.id);
          const newSocket = io("http://localhost:3001", {
            transports: ["websocket"],
            withCredentials: true,
            auth: { token: data.token },
          });

          newSocket.on("connect", () => console.log("Connected to socket:", newSocket.id));
          newSocket.on("receiveMessage", (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
          });

          setSocket(newSocket);
        }
      })
      .catch(() => console.log("Not logged in"));
  }, []);

  useEffect(() => {
    fetch("http://localhost:3001/auth/users", {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setUsers)
      .catch((err) => console.error("Error fetching users:", err));
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      fetch(`http://localhost:3001/auth/search?query=${searchQuery}`, {
        method: "GET",
        credentials: "include",
      })
        .then((res) => res.json())
        .then(setSearchResults)
        .catch((err) => console.error("Error searching users:", err));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedUser || !userId) return;
    
    const chatId = userId < selectedUser ? `${userId}_${selectedUser}` : `${selectedUser}_${userId}`;
    
    fetch(`http://localhost:3001/messages/${chatId}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setMessages(data.messages))
      .catch((err) => console.error("Error fetching messages:", err));
  }, [selectedUser, userId]);

  const sendMessage = () => {
    if (!userId || !socket || !message.trim() || !selectedUser) return;
    
    const newMessage = { sender_id: userId, receiver_id: selectedUser, content: message };
    socket.emit("sendMessage", newMessage);
    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
  };

  const updateProfile = () => {
    const formData = new FormData();
    formData.append("name", profileName);
    if (profilePic) formData.append("profile_pic", profilePic);

    fetch("http://localhost:3001/auth/update-profile", {
      method: "POST",
      credentials: "include",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) alert("Profile updated successfully!");
      })
      .catch((err) => console.error("Error updating profile:", err));
  };


  return (
    <div className="flex w-full h-screen bg-gray-900 text-white">
    <div className="w-1/4 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
      <div className="flex justify-between mb-2">
        <h2 className="text-lg font-bold">Chats</h2>
        <button className="px-4 py-1 bg-green-500 rounded" onClick={() => setShowProfile(true)}>Profile</button>
      </div>
      {showProfile && (
          <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50">
            <div className="bg-gray-800 p-5 rounded-lg">
              <h2 className="text-lg font-bold mb-2">Edit Profile</h2>
              <input type="text" className="w-full p-2 mb-2 bg-gray-700 text-white rounded" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Enter Name" />
              <input type="file" accept="image/*" className="w-full p-2 mb-2 bg-gray-700 text-white rounded" onChange={(e) => setProfilePic(e.target.files[0])} />
              <button className="w-full bg-blue-500 p-2 rounded" onClick={updateProfile}>Save</button>
              <button className="w-full bg-red-500 p-2 mt-2 rounded" onClick={() => setShowProfile(false)}>Close</button>
            </div>
          </div>
        )}
        <div className="flex mb-2">
          <input
            type="text"
            className="w-full p-2 rounded bg-gray-700 text-white"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="ml-2 px-4 py-2 bg-blue-500 rounded"
            onClick={() => setShowSearch(!showSearch)}
          >
            +
          </button>
        </div>
        {showSearch && (
          <div className="bg-gray-700 p-2 rounded">
            {searchResults.map((user) => (
              <button
              key={user.id}
              className="block w-full text-left p-2 hover:bg-gray-600"
              onClick={() => {
                if (!users.some((u) => u.id === user.id)) {
                  setUsers([...users, user]); // Add to chat list if not already present
                }
                setSelectedUser(user.id); // Select the user
                setShowSearch(false); // Hide search results after selection
              }}
            >
              {user.name}
            </button>
            
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 mt-4">

{users.map((user, index) => (
  <button key={user.id || index} className={`flex items-center w-full p-2 text-left rounded-lg ${selectedUser === user.id ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`} onClick={() => setSelectedUser(user.id)}>
    <img src={`http://localhost:3001/uploads/${user.profile_pic}`} alt="Profile" className="w-10 h-10 rounded-full object-cover mr-3" />
    <span>{user.name || `User ${user.id || index}`}</span>
  </button>
))}


        </div>
      </div>

      <div className="w-3/4 flex flex-col bg-gray-900">
        <div className="bg-gray-800 text-white p-3 font-semibold text-center">
          {selectedUser ? <span>Chat with {users.find((u) => u.id === selectedUser)?.name || `User ${selectedUser}`}</span> : <span>Select a user to chat</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.filter((msg) => (msg.sender_id === userId && msg.receiver_id === selectedUser) || (msg.sender_id === selectedUser && msg.receiver_id === userId)).map((msg, index) => (
            <div key={index} className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
              <div className={`p-3 min-w-[100px] max-w-[80%] rounded-lg text-white shadow-lg ${msg.sender_id === userId ? "bg-blue-500" : "bg-gray-700"}`}>
                <p className="text-base font-medium break-words whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 flex border-t border-gray-700 bg-gray-800">
  {/* Text Input */}
  <input
    type="text"
    className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
    placeholder="Type a message..."
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
    disabled={!selectedUser}
  />

  {/* Hidden File Input */}
  <input
    type="file"
    accept="image/*,video/*"
    className="hidden"
    id="fileInput"
    onChange={(e) => setFile(e.target.files[0])}
  />

  {/* Attach Button */}
  <label htmlFor="fileInput" className="ml-2 px-4 py-2 bg-gray-500 text-white rounded-lg cursor-pointer">
    📎
  </label>

  {/* Send Button */}
  <button onClick={sendMessage} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg" disabled={!selectedUser}>
    Send
  </button>
</div>
{messages.map((msg) => (
  <div key={msg.id} className="message">
    {msg.message && <p>{msg.message}</p>}

    {msg.file_path && (
      msg.file_path.endsWith(".mp4") || msg.file_path.endsWith(".webm") ? (
        <video controls src={`http://localhost:3001/uploads/messages/${msg.file_path}`} width="250" />
      ) : (
        <img src={`http://localhost:3001/uploads/messages/${msg.file_path}`} alt="Sent media" width="250" />
      )
    )}
  </div>
))}
      </div>
    </div>
  );
};

export default Room;
