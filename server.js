const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

// In-memory cache
let exchangeRatesCache = null;
let cacheExpirationTime = null;
let validCurrencyCodes = [];
let hasUpdatedCurrencyCodes = false; // Flag to track whether valid currency codes have been updated

// Middleware to retrieve and update valid currency codes
const updateValidCurrencyCodes = async () => {
  try {
    const response = await axios.get(
      "https://api.apilayer.com/exchangerates_data/latest?base=usd",
      {
        headers: {
          apikey: process.env.API_KEY,
        },
      }
    );

    validCurrencyCodes = Object.keys(response.data.rates);
  } catch (error) {
    console.error("Error updating valid currency codes:", error);
  }
};

// Middleware to check and refresh the cache if needed
const checkCache = async (req, res, next) => {
  try {
    if (!exchangeRatesCache || Date.now() > cacheExpirationTime) {
      // Fetch data from the external API
      const response = await axios.get(
        "https://api.apilayer.com/exchangerates_data/latest?base=usd",
        {
          headers: {
            apikey: process.env.API_KEY,
          },
        }
      );

      exchangeRatesCache = response.data;

      // Update valid currency codes only if not already updated
      if (!hasUpdatedCurrencyCodes) {
        await updateValidCurrencyCodes();
        hasUpdatedCurrencyCodes = true;
      }

      // Cache for 1 hour (60 minutes * 60 seconds * 1000 milliseconds)
      cacheExpirationTime = Date.now() + 60 * 60 * 1000;
    }
    next();
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Initial call to update valid currency codes
updateValidCurrencyCodes();

// Endpoint to get home
app.get("/", (req, res) => {
  res.status(200).send(
    `<h1>Exchange Rates API</h1>
      End-Point : <code><a href="/api">/api</a></code>`
  );
});

// Endpoint to get exchange rates
app.get("/api", checkCache, (req, res) => {
  if (!exchangeRatesCache || Object.keys(exchangeRatesCache).length === 0) {
    res.status(204).json({ error: "No data found!" });
  } else {
    res.status(200).json(exchangeRatesCache);
  }
});

// Endpoint to get exchange rate for a specific currency against USD
app.get("/api/:currencyCode", checkCache, (req, res) => {
  const currencyCode = req.params.currencyCode.toUpperCase();

  if (
    !exchangeRatesCache ||
    !exchangeRatesCache.rates ||
    !exchangeRatesCache.rates[currencyCode] ||
    !validCurrencyCodes.includes(currencyCode)
  ) {
    res.status(204).json({
      error: `Invalid currency code or no data found for ${currencyCode}`,
    });
  } else {
    const exchangeRate = exchangeRatesCache.rates[currencyCode];
    res.status(200).json({ currencyCode, exchangeRate });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
