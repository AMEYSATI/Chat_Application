import React from "react";
import ReactDOM from "react-dom/client";
import Room from "./App"; // Lowercase 'h'

import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Room /> {/* Capitalized */}
  </React.StrictMode>
);

reportWebVitals();
