import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React from "react";
import Login from "./Login";
import Register from "./Register";
import Room from "./Room";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/room" element={<Room />} />
      </Routes>
    </Router>
  );
}

export default App;
