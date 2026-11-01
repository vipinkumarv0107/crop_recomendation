
"use strict";

// ======================================
// AgriAI - Crop Recommendation System
// ======================================

const API_URL = "https://crop-recomendation-4.onrender.com";

// Get HTML elements
const form = document.getElementById("predictionForm");
const button = document.getElementById("predictButton");
const buttonText = document.getElementById("buttonText");

const result = document.getElementById("result");
const description = document.getElementById("resultDescription");

const confidenceBox = document.getElementById("confidenceBox");
const confidence = document.getElementById("confidence");

const cropSection = document.getElementById("cropProbabilitySection");
const cropList = document.getElementById("cropList");

const errorMessage = document.getElementById("errorMessage");

// ======================================
// Read Input Values
// ======================================

function getInputData() {

    return {
        nitrogen: Number(document.getElementById("nitrogen").value),
        phosphorus: Number(document.getElementById("phosphorus").value),
        potassium: Number(document.getElementById("potassium").value),
        temperature: Number(document.getElementById("temperature").value),
        humidity: Number(document.getElementById("humidity").value),
        ph_value: Number(document.getElementById("ph_value").value),
        rainfall: Number(document.getElementById("rainfall").value)
    };
}

// ======================================
// Validate Input
// ======================================

function validateData(data) {

    for (const [key, value] of Object.entries(data)) {

        if (!Number.isFinite(value)) {
            throw new Error(`Please enter a valid ${key}.`);
        }
    }

    if (data.nitrogen < 0 ||
        data.phosphorus < 0 ||
        data.potassium < 0 ||
        data.rainfall < 0) {
        throw new Error("Soil nutrients and rainfall cannot be negative.");
    }

    if (data.temperature < -10 || data.temperature > 60) {
        throw new Error("Temperature must be between -10 and 60°C.");
    }

    if (data.humidity < 0 || data.humidity > 100) {
        throw new Error("Humidity must be between 0 and 100%.");
    }

    if (data.ph_value < 0 || data.ph_value > 14) {
        throw new Error("Soil pH must be between 0 and 14.");
    }
}

// ======================================
// Show Error
// ======================================

function showError(message) {

    errorMessage.textContent = message;
    errorMessage.style.display = "block";
}

function clearError() {

    errorMessage.textContent = "";
    errorMessage.style.display = "none";
}

// ======================================
// Display Crop Probabilities
// ======================================

function displayCropProbabilities(crops) {

    cropList.innerHTML = "";

    if (!Array.isArray(crops) || crops.length === 0) {
        cropSection.style.display = "none";
        return;
    }

    crops.forEach(item => {

        const percentage = Math.max(
            0,
            Math.min(100, Number(item.percentage))
        );

        if (!item.crop || !Number.isFinite(percentage)) {
            return;
        }

        const cropItem = document.createElement("div");
        cropItem.className = "crop-item";

        const info = document.createElement("div");
        info.className = "crop-info";

        const name = document.createElement("span");
        name.className = "crop-name";
        name.textContent = item.crop;

        const percent = document.createElement("span");
        percent.className = "crop-percent";
        percent.textContent = percentage.toFixed(2) + "%";

        const progressContainer = document.createElement("div");
        progressContainer.className = "progress-container";

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";

        progressBar.style.width = percentage + "%";

        info.append(name, percent);
        progressContainer.appendChild(progressBar);

        cropItem.append(info, progressContainer);

        cropList.appendChild(cropItem);
    });

    cropSection.style.display = "block";
}

// ======================================
// Display Prediction Result
// ======================================

function displayResult(data) {

    if (!data.recommended_crop) {
        throw new Error("Invalid prediction response from server.");
    }

    result.textContent = data.recommended_crop;

    description.textContent =
        "This crop is the most suitable recommendation based on your soil and weather data.";

    confidence.textContent =
        Number(data.confidence).toFixed(2) + "%";

    confidenceBox.style.display = "inline-block";

    displayCropProbabilities(data.crop_probabilities);
}

// ======================================
// Call FastAPI Backend
// ======================================

async function predictCrop(data) {

    const response = await fetch(
        `${API_URL}/predict`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(data)
        }
    );

    const responseData = await response.json();

    if (!response.ok) {

        throw new Error(
            responseData.detail || "Crop prediction failed."
        );
    }

    return responseData;
}

// ======================================
// Form Submit Event
// ======================================

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    clearError();

    try {

        const inputData = getInputData();

        validateData(inputData);

        // Loading state
        button.disabled = true;

        buttonText.textContent =
            "⏳ Analyzing Soil Data...";

        result.textContent = "Analyzing...";

        description.textContent =
            "AI model is processing your information.";

        // API request
        const prediction = await predictCrop(inputData);

        // Display result
        displayResult(prediction);

    }

    catch (error) {

        console.error("Prediction Error:", error);

        showError(error.message);

        result.textContent = "Prediction Failed";

        description.textContent =
            "Please check your inputs and backend connection.";

    }

    finally {

        button.disabled = false;

        buttonText.textContent =
            "🤖 Predict Best Crop";
    }
});

// ======================================
// Backend Health Check
// ======================================

async function checkBackend() {

    try {

        const response = await fetch(
            `${API_URL}/health`
        );

        if (!response.ok) {
            throw new Error("Backend unavailable");
        }

        const data = await response.json();

        console.log("AgriAI Backend:", data);

    }

    catch (error) {

        console.warn(
            "Backend connection failed:",
            error.message
        );
    }
}

// Initialize
confidenceBox.style.display = "none";
cropSection.style.display = "none";

checkBackend();
