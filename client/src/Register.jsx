import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [profilePic, setProfilePic] = useState(null);
    const navigate = useNavigate();

    function handleChange(event, setter) {
        setter(event.target.value);
    }

    function handleProfilePicChange(event) {
        setProfilePic(event.target.files[0]); // Store file object
    }

    async function registerUser(event) {
        event.preventDefault();

        if (!profilePic) {
            alert("Please upload a profile picture.");
            return;
        }

        const formData = new FormData();
        formData.append("name", name);
        formData.append("email", email);
        formData.append("password", password);
        formData.append("profilepic", profilePic);

        try {
            const response = await axios.post(
                "https://chat-application-4ik8.onrender.com/auth/register",
                formData,
                { 
                    withCredentials: true,
                    headers: { "Content-Type": "multipart/form-data" }
                }
            );

            if (response.status === 201) {
                alert("Registration successful!");
                navigate("/login");
            }
        } catch (error) {
            console.error("Error registering user:", error);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="bg-gray-800 shadow-lg rounded-2xl p-8 w-96 border border-gray-700">
                <h1 className="text-2xl font-semibold text-center mb-6 text-white">
                    Create an Account
                </h1>
                <form onSubmit={registerUser} encType="multipart/form-data" className="space-y-4">
                    <input
                        type="text"
                        onChange={(e) => handleChange(e, setName)}
                        value={name}
                        placeholder="Full Name"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    />
                    <input
                        type="email"
                        onChange={(e) => handleChange(e, setEmail)}
                        value={email}
                        placeholder="Email"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    />
                    <input
                        type="password"
                        onChange={(e) => handleChange(e, setPassword)}
                        value={password}
                        placeholder="Password"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePicChange}
                        required
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-500 file:bg-gray-600 file:text-white hover:file:bg-gray-500 cursor-pointer"
                    />
                    <button 
                        type="submit" 
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-500 transition duration-300"
                    >
                        Register
                    </button>
                </form>
                <p className="text-center text-gray-400 mt-4">
                    Already have an account?{" "}
                    <span 
                        onClick={() => navigate("/login")} 
                        className="text-blue-400 cursor-pointer hover:underline"
                    >
                        Login
                    </span>
                </p>
            </div>
        </div>
    );
}

export default Register;
