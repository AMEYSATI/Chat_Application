import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleEmailChange = (event) => {
        setEmail(event.target.value);
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
    };

    const loginUser = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post(
                "https://chat-application-4ik8.onrender.com/auth/login",
                { email, password },
                { withCredentials: true }
            );

            if (response.status === 200) {
                navigate("/room");
            }
        } catch (error) {
            if (error.response) {
                if (error.response.status === 400 || error.response.status === 401) {
                    alert("Invalid email or password");
                } else {
                    console.error("Error logging in:", error);
                    alert("There was an error logging in");
                }
            } else {
                console.error("Error logging in:", error);
                alert("There was an error logging in");
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="bg-gray-800 shadow-lg rounded-2xl p-8 w-96 border border-gray-700">
                <h1 className="text-2xl font-semibold text-center mb-6 text-white">
                    Welcome Back
                </h1>
                <form onSubmit={loginUser} className="space-y-4">
                    <input
                        type="email"
                        name="email"
                        value={email}
                        onChange={handleEmailChange}
                        placeholder="Email"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    />
                    <input
                        type="password"
                        name="password"
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="Password"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-500 transition duration-300"
                    >
                        Login
                    </button>
                </form>
                <p className="text-center text-gray-400 mt-4">
                    Don't have an account?{" "}
                    <span 
                        onClick={() => navigate("/register")} 
                        className="text-blue-400 cursor-pointer hover:underline"
                    >
                        Register
                    </span>
                </p>
            </div>
        </div>
    );
}

export default Login;
