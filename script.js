
/* ==========================================
   AgriAI - Crop Recommendation System
   Frontend JavaScript
   Backend: Python + FastAPI
========================================== */

// API Configuration
const API_URL = "https://crop-recomendation-4.onrender.com";

// DOM Elements
const form = document.getElementById("predictionForm");

// ==========================================
// 1. FORM SUBMISSION
// ==========================================

if (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const button = form.querySelector(
            "button[type='submit']"
        );

        const originalButtonText = button
            ? button.innerHTML
            : "Predict Crop";

        try {
            // Get input values
            const data = {
                nitrogen: parseFloat(
                    document.getElementById("nitrogen").value
                ),

                phosphorus: parseFloat(
                    document.getElementById("phosphorus").value
                ),

                potassium: parseFloat(
                    document.getElementById("potassium").value
                ),

                temperature: parseFloat(
                    document.getElementById("temperature").value
                ),

                humidity: parseFloat(
                    document.getElementById("humidity").value
                ),

                ph_value: parseFloat(
                    document.getElementById("ph_value").value
                ),

                rainfall: parseFloat(
                    document.getElementById("rainfall").value
                )
            };

            // Validate inputs
            for (const key in data) {
                if (!Number.isFinite(data[key])) {
                    showError(
                        `Please enter a valid value for ${key}.`
                    );
                    return;
                }
            }

            // Loading state
            if (button) {
                button.disabled = true;
                button.innerHTML = "🌱 Predicting...";
            }

            showStatus(
                "Analyzing soil and weather conditions...",
                "loading"
            );

            // Send request to FastAPI
            const response = await fetch(
                `${API_URL}/predict`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },

                    body: JSON.stringify(data)
                }
            );

            // Read response safely
            const responseText = await response.text();

            let result;

            try {
                result = responseText
                    ? JSON.parse(responseText)
                    : {};
            } catch (error) {
                throw new Error(
                    `Server returned invalid JSON. ` +
                    `HTTP Status: ${response.status}. ` +
                    `Response: ${responseText.slice(0, 200)}`
                );
            }

            // Handle HTTP errors
            if (!response.ok) {
                let errorMessage = "Prediction failed.";

                if (result.detail) {
                    if (Array.isArray(result.detail)) {
                        errorMessage = result.detail
                            .map(error => error.msg || JSON.stringify(error))
                            .join(", ");
                    } else {
                        errorMessage = result.detail;
                    }
                } else if (result.message) {
                    errorMessage = result.message;
                } else {
                    errorMessage =
                        `Server error: HTTP ${response.status}`;
                }

                throw new Error(errorMessage);
            }

            // Validate API response
            if (!result.recommended_crop) {
                throw new Error(
                    "Invalid API response: recommended_crop is missing."
                );
            }

            // Display prediction
            displayPrediction(result);

            showStatus(
                "Prediction completed successfully! 🌱",
                "success"
            );

        } catch (error) {

            console.error("FastAPI Error:", error);

            let message = error.message;

            if (
                error instanceof TypeError &&
                error.message.includes("fetch")
            ) {
                message =
                    "Unable to reach the backend. " +
                    "Check your internet connection, " +
                    "backend deployment, and CORS settings.";
            }

            showError(message);

        } finally {

            // Reset button
            if (button) {
                button.disabled = false;
                button.innerHTML = originalButtonText;
            }
        }
    });
}


// ==========================================
// 2. DISPLAY PREDICTION
// ==========================================

function displayPrediction(result) {

    // Recommended crop
    const resultElement =
        document.getElementById("result");

    if (resultElement) {
        resultElement.textContent =
            result.recommended_crop || "Unknown";
    }

    // Crop description
    const descriptionElement =
        document.getElementById("resultDescription");

    if (descriptionElement) {
        const crop = result.recommended_crop || "crop";

        descriptionElement.textContent =
            `${crop} is recommended based on the provided ` +
            "soil and environmental conditions.";
    }

    // Confidence percentage
    const confidenceBox =
        document.getElementById("confidenceBox");

    const confidenceElement =
        document.getElementById("confidence");

    if (
        confidenceElement &&
        result.confidence !== undefined &&
        result.confidence !== null
    ) {
        const confidence = Number(result.confidence);

        if (Number.isFinite(confidence)) {
            confidenceElement.textContent =
                `${confidence.toFixed(2)}%`;

            if (confidenceBox) {
                confidenceBox.style.display = "block";
            }
        }
    }

    // Crop probability list
    const probabilitySection =
        document.getElementById("cropProbabilitySection");

    const cropList =
        document.getElementById("cropList");

    if (
        probabilitySection &&
        cropList &&
        Array.isArray(result.crop_probabilities)
    ) {

        // Clear previous results
        cropList.innerHTML = "";

        // Sort highest probability first
        const probabilities =
            [...result.crop_probabilities].sort(
                (a, b) =>
                    Number(b.percentage) -
                    Number(a.percentage)
            );

        // Create crop probability cards
        probabilities.forEach((item, index) => {

            const crop =
                item.crop || "Unknown";

            const percentage =
                Number(item.percentage) || 0;

            // Main container
            const cropItem =
                document.createElement("div");

            cropItem.className =
                "crop-probability-item";

            // Header
            const header =
                document.createElement("div");

            header.className =
                "crop-probability-header";

            // Crop name
            const cropName =
                document.createElement("span");

            cropName.className = "crop-name";

            cropName.textContent =
                `${index + 1}. ${crop}`;

            // Percentage
            const percentageText =
                document.createElement("span");

            percentageText.className =
                "crop-percentage";

            percentageText.textContent =
                `${percentage.toFixed(2)}%`;

            header.appendChild(cropName);
            header.appendChild(percentageText);

            // Progress background
            const progress =
                document.createElement("div");

            progress.className = "progress";

            // Progress bar
            const progressBar =
                document.createElement("div");

            progressBar.className =
                "progress-bar";

            progressBar.style.width = "0%";

            progress.appendChild(progressBar);

            cropItem.appendChild(header);
            cropItem.appendChild(progress);

            cropList.appendChild(cropItem);

            // Animate progress bar
            requestAnimationFrame(() => {
                progressBar.style.width =
                    `${Math.min(Math.max(percentage, 0), 100)}%`;
            });
        });

        probabilitySection.style.display = "block";
    }

    // Show result section
    const resultContainer =
        document.getElementById("resultContainer");

    if (resultContainer) {
        resultContainer.style.display = "block";

        resultContainer.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}


// ==========================================
// 3. SHOW ERROR MESSAGE
// ==========================================

function showError(message) {

    console.error(message);

    const status =
        document.getElementById("status");

    if (status) {
        status.textContent = message;

        status.className = "status error";

        status.style.display = "block";

    } else {
        alert(message);
    }
}


// ==========================================
// 4. SHOW STATUS MESSAGE
// ==========================================

function showStatus(message, type) {

    const status =
        document.getElementById("status");

    if (!status) {
        return;
    }

    status.textContent = message;

    status.className = `status ${type}`;

    status.style.display = "block";
}


// ==========================================
// 5. RESET PREDICTION FORM
// ==========================================

function resetPrediction() {

    if (form) {
        form.reset();
    }

    // Hide result
    const resultContainer =
        document.getElementById("resultContainer");

    if (resultContainer) {
        resultContainer.style.display = "none";
    }

    // Clear crop list
    const cropList =
        document.getElementById("cropList");

    if (cropList) {
        cropList.innerHTML = "";
    }

    // Hide confidence
    const confidenceBox =
        document.getElementById("confidenceBox");

    if (confidenceBox) {
        confidenceBox.style.display = "none";
    }

    // Hide probability section
    const probabilitySection =
        document.getElementById("cropProbabilitySection");

    if (probabilitySection) {
        probabilitySection.style.display = "none";
    }

    // Clear status
    const status =
        document.getElementById("status");

    if (status) {
        status.textContent = "";
        status.style.display = "none";
    }
}


// ==========================================
// 6. CHECK FASTAPI CONNECTION
// ==========================================

async function checkAPIConnection() {

    try {

        const response = await fetch(
            `${API_URL}/docs`,
            {
                method: "GET",
                headers: {
                    "Accept": "text/html"
                }
            }
        );

        if (response.ok) {

            console.log(
                "FastAPI connected successfully:",
                API_URL
            );

        } else {

            console.warn(
                "FastAPI responded with:",
                response.status
            );
        }

    } catch (error) {

        console.warn(
            "FastAPI connection failed:",
            error.message
        );
    }
}


// ==========================================
// 7. PAGE INITIALIZATION
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log("🌱 AgriAI frontend loaded");

        console.log(
            "FastAPI Backend:",
            API_URL
        );

        checkAPIConnection();

    }
);
