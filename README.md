### Rocket Flight Center

This repository contains the source code for a web-based **Model Rocket Flight Log** application. It serves as a tool for hobbyists to manage their rocket and engine profiles, plan flights with performance estimations, log flight data, and analyze post-flight results from a flight computer.

***

### 🚀 Features

* **Rocket & Engine Management**: Create, edit, and delete profiles for your custom rockets and standard model rocket engines.
* **Pre-Flight Estimation**: Run simulations based on rocket and engine specifications to estimate key performance metrics like total altitude, max velocity, and stability.
* **Flight Logging**: Log your flights, track their outcomes (Success or Failure), and add personal notes.
* **Data Analysis**: Analyze raw CSV data from a flight computer to calculate and display actual flight performance metrics such as max altitude, max G-force, and top speed.
* **Interactive Charts**: Visualize flight data with altitude and acceleration charts generated from flight computer data.
* **Data Persistence**: All saved rocket, engine, and flight data is stored locally in your browser using `localStorage`, ensuring your data is always available.
* **Responsive UI & Dark Mode**: A modern, responsive user interface built with Tailwind CSS, including a toggle for light and dark modes.

***

### 🛠️ Technologies Used

* **HTML**: Provides the foundational structure of the application.
* **CSS**: Styled using **Tailwind CSS** for a utility-first approach and a custom stylesheet for additional theming.
* **JavaScript**: Powers the entire application logic, from data handling and calculations to UI interactions.
* **Chart.js**: A powerful charting library used to render the flight data graphs.
* **MathJax**: Renders mathematical equations for detailed calculation explanations within the application.

***

### ⚙️ How to Use

Simply open the `index.html` file in any modern web browser to run the application. No server or additional setup is required. The application will immediately be ready for use, and all data will be saved to your browser's local storage.

***

### 📄 Version

* **Version**: 1.2.5
